#!/usr/bin/env python3
"""Extract user-facing copy from the published localized calculator sources.

The unified migration should inherit wording from the existing product instead
of inventing a second translation corpus. This script parses every source file
listed in data/routes.json and emits one machine-readable locale document for
preview builds. It does not modify production files or calculation data.
"""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ROOT / "data" / "routes.json"

VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


class Node:
    def __init__(self, tag: str, attrs: list[tuple[str, str | None]], parent: "Node | None" = None):
        self.tag = tag
        self.attrs = {key: (value or "") for key, value in attrs}
        self.parent = parent
        self.children: list[Node | str] = []

    @property
    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())


class TreeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document", [])
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)


def walk(node: Node) -> Iterable[Node]:
    yield node
    for child in node.children:
        if isinstance(child, Node):
            yield from walk(child)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def node_text(node: Node | None, *, exclude_classes: set[str] | None = None) -> str:
    if node is None:
        return ""
    exclude_classes = exclude_classes or set()
    chunks: list[str] = []

    def collect(current: Node | str) -> None:
        if isinstance(current, str):
            chunks.append(current)
            return
        if current.classes & exclude_classes:
            return
        for child in current.children:
            collect(child)

    collect(node)
    return normalize(" ".join(chunks))


def find_id(root: Node, element_id: str) -> Node | None:
    return next((node for node in walk(root) if node.attrs.get("id") == element_id), None)


def find_class(root: Node | None, class_name: str) -> Node | None:
    if root is None:
        return None
    return next((node for node in walk(root) if class_name in node.classes), None)


def find_all_class(root: Node | None, class_name: str) -> list[Node]:
    if root is None:
        return []
    return [node for node in walk(root) if class_name in node.classes]


def find_tag(root: Node | None, tag: str) -> Node | None:
    if root is None:
        return None
    return next((node for node in walk(root) if node.tag == tag), None)


def ancestor(node: Node | None, class_name: str) -> Node | None:
    current = node.parent if node else None
    while current is not None:
        if class_name in current.classes:
            return current
        current = current.parent
    return None


def element_children(node: Node | None) -> list[Node]:
    if node is None:
        return []
    return [child for child in node.children if isinstance(child, Node)]


def previous_element(node: Node | None) -> Node | None:
    if node is None or node.parent is None:
        return None
    siblings = element_children(node.parent)
    try:
        index = siblings.index(node)
    except ValueError:
        return None
    return siblings[index - 1] if index > 0 else None


def next_element(node: Node | None) -> Node | None:
    if node is None or node.parent is None:
        return None
    siblings = element_children(node.parent)
    try:
        index = siblings.index(node)
    except ValueError:
        return None
    return siblings[index + 1] if index + 1 < len(siblings) else None


def line_around_direct_child(target: Node | None) -> tuple[str, str]:
    """Return visible text before/after target until the nearest <br> siblings."""
    if target is None or target.parent is None:
        return "", ""
    siblings = target.parent.children
    try:
        index = siblings.index(target)
    except ValueError:
        return "", ""

    start = index - 1
    while start >= 0:
        sibling = siblings[start]
        if isinstance(sibling, Node) and sibling.tag == "br":
            break
        start -= 1

    end = index + 1
    while end < len(siblings):
        sibling = siblings[end]
        if isinstance(sibling, Node) and sibling.tag == "br":
            break
        end += 1

    before_node = Node("fragment", [])
    before_node.children = siblings[start + 1:index]
    after_node = Node("fragment", [])
    after_node.children = siblings[index + 1:end]
    before = node_text(before_node, exclude_classes={"pw2-tooltip"}).lstrip("•·- ")
    after = node_text(after_node, exclude_classes={"pw2-tooltip"}).lstrip("•·- ")
    return before, after


def value_template(target: Node | None) -> str:
    """Preserve the source language's number position using a {value} token."""
    before, after = line_around_direct_child(target)
    return normalize(f"{before} {{value}} {after}")


def require(value: str, language: str, label: str) -> str:
    value = normalize(value)
    if not value:
        raise SystemExit(f"{language}: unable to extract {label}")
    return value


def metric(root: Node, language: str, element_id: str, key: str) -> dict[str, str]:
    target = find_id(root, element_id)
    card = ancestor(target, "pw2-card")
    return {
        "label": require(node_text(find_class(card, "pw2-h3-title"), exclude_classes={"pw2-tooltip"}), language, f"{key}.label"),
        "description": require(node_text(find_class(card, "pw2-desc"), exclude_classes={"pw2-tooltip"}), language, f"{key}.description"),
        "tooltip": require(node_text(find_class(card, "pw2-tooltip")), language, f"{key}.tooltip"),
    }


def programme(root: Node, language: str, element_id: str, key: str) -> dict[str, str]:
    target = find_id(root, element_id)
    item = ancestor(target, "pw2-item")
    return {
        "label": require(node_text(find_class(item, "pw2-item-title"), exclude_classes={"pw2-tooltip"}), language, f"programme.{key}.label"),
        "note": require(node_text(find_class(item, "pw2-item-note"), exclude_classes={"pw2-tooltip"}), language, f"programme.{key}.note"),
        "tooltip": require(node_text(find_class(item, "pw2-tooltip")), language, f"programme.{key}.tooltip"),
        "initialValue": node_text(target, exclude_classes={"pw2-tooltip"}),
    }


def extract(language: str, source: Path) -> dict:
    parser = TreeParser()
    parser.feed(source.read_text(encoding="utf-8"))
    root = parser.root

    spend_per_second = find_id(root, "pw2-spend-per-sec")
    live_prefix, live_suffix = line_around_direct_child(spend_per_second)
    hero = ancestor(spend_per_second, "pw2-hero")
    hero_title = find_class(hero, "pw2-h1")
    hero_subtitle_node = None
    if hero_title:
        hero_subtitle_node = find_class(hero_title, "pw2-h1-sub")
        if hero_subtitle_node is None:
            hero_subtitle_node = next((child for child in element_children(hero_title) if child.tag == "span"), None)

    lead = find_class(hero, "pw2-lead")
    hero_tooltip = find_class(lead, "pw2-tooltip")

    viewer_spend = find_id(root, "pw2-viewerSpend")
    live_box = ancestor(viewer_spend, "pw2-live-box")
    session_title = find_class(live_box, "pw2-live-label")
    session_note = find_class(live_box, "pw2-live-note")
    food_target = find_id(root, "pw2-live-hunger")
    health_target = find_id(root, "pw2-live-health")
    poverty_target = find_id(root, "pw2-live-poverty")
    bullet_container = food_target.parent if food_target else None
    alternatives = previous_element(bullet_container)

    personal = metric(root, language, "pw2-personal-tax", "personal")
    direct = metric(root, language, "pw2-directDeaths", "direct")
    indirect = metric(root, language, "pw2-indirectDeaths", "indirect")
    infrastructure = metric(root, language, "pw2-infraDamage", "infrastructure")
    life = metric(root, language, "pw2-lifeYearsLost", "life")
    economic_loss = metric(root, language, "pw2-economicLoss", "economicLoss")

    economic_card = ancestor(find_id(root, "pw2-infraDamage"), "pw2-card")
    economic_section = ancestor(economic_card, "pw2-section")

    share_range = find_id(root, "pw2-shareRange")
    opportunity_section = ancestor(share_range, "pw2-section")
    scenario_spectrum = find_class(opportunity_section, "pw2-range-subtitle")

    programmes = {
        "education": programme(root, language, "pw2-educationEquivalent", "education"),
        "hunger": programme(root, language, "pw2-hungerEquivalent", "hunger"),
        "health": programme(root, language, "pw2-healthEquivalent", "health"),
        "water": programme(root, language, "pw2-waterEquivalent", "water"),
        "electricity": programme(root, language, "pw2-electricityEquivalent", "electricity"),
        "internet": programme(root, language, "pw2-internetEquivalent", "internet"),
        "climate": programme(root, language, "pw2-climateEquivalent", "climate"),
        "schools": programme(root, language, "pw2-schoolsEquivalent", "schools"),
    }

    show_more = find_id(root, "pw2-show-more-btn")

    viral = find_id(root, "pw2-viral-card")
    scale_day = find_id(root, "pw2-viral-day")
    scale_month = find_id(root, "pw2-viral-month")
    scale_year = find_id(root, "pw2-viral-year")
    day_label = node_text(previous_element(scale_day), exclude_classes={"pw2-tooltip"})
    month_label = node_text(previous_element(scale_month), exclude_classes={"pw2-tooltip"})
    year_label = node_text(previous_element(scale_year), exclude_classes={"pw2-tooltip"})

    mission_block = find_id(root, "pw2-mission-block")
    cta = find_class(mission_block, "pw2-cta-main")
    philosophy = find_class(root, "pw2-philosophy-card")
    philosophy_intros = find_all_class(philosophy, "pw2-intro")
    quote = find_class(philosophy, "pw2-quote-text")
    quote_parent = quote.parent if quote else None
    quote_source = next_element(quote) if quote else None
    if quote_source is None and quote_parent:
        quote_source = next((node for node in element_children(quote_parent) if node is not quote), None)

    main_total = find_id(root, "pw2-totalSpend")
    main_card = ancestor(main_total, "pw2-hero-counter")
    main_tooltip = find_class(main_card, "pw2-tooltip")
    main_caption = find_id(root, "pw2-heroSubcopy")

    return {
        "source": source.relative_to(ROOT).as_posix(),
        "hero": {
            "subtitle": require(node_text(hero_subtitle_node), language, "hero.subtitle"),
            "livePrefix": normalize(live_prefix),
            "liveSuffix": normalize(live_suffix),
            "liveTemplate": require(value_template(spend_per_second), language, "hero.liveTemplate"),
            "lead": require(node_text(lead, exclude_classes={"pw2-tooltip"}), language, "hero.lead"),
            "tooltip": require(node_text(hero_tooltip), language, "hero.tooltip"),
            "mainCaption": require(node_text(main_caption, exclude_classes={"pw2-tooltip"}), language, "hero.mainCaption"),
            "mainTooltip": require(node_text(main_tooltip), language, "hero.mainTooltip"),
        },
        "session": {
            "title": require(node_text(session_title), language, "session.title"),
            "note": require(node_text(session_note), language, "session.note"),
            "alternatives": require(node_text(alternatives, exclude_classes={"pw2-tooltip"}), language, "session.alternatives"),
            "foodTemplate": require(value_template(food_target), language, "session.foodTemplate"),
            "healthTemplate": require(value_template(health_target), language, "session.healthTemplate"),
            "povertyTemplate": require(value_template(poverty_target), language, "session.povertyTemplate"),
        },
        "metrics": {
            "personal": personal,
            "direct": direct,
            "indirect": indirect,
            "infrastructure": infrastructure,
            "life": life,
            "economicLoss": economic_loss,
        },
        "economic": {
            "title": require(node_text(find_class(economic_section, "pw2-h2"), exclude_classes={"pw2-tooltip"}), language, "economic.title"),
            "intro": require(node_text(find_class(economic_section, "pw2-intro"), exclude_classes={"pw2-tooltip"}), language, "economic.intro"),
        },
        "opportunity": {
            "title": require(node_text(find_class(opportunity_section, "pw2-h2"), exclude_classes={"pw2-tooltip"}), language, "opportunity.title"),
            "intro": require(node_text(find_class(opportunity_section, "pw2-intro"), exclude_classes={"pw2-tooltip"}), language, "opportunity.intro"),
            "scenarioSpectrum": require(node_text(scenario_spectrum, exclude_classes={"pw2-tooltip"}), language, "opportunity.scenarioSpectrum"),
            "showMore": require(node_text(show_more, exclude_classes={"pw2-tooltip"}), language, "opportunity.showMore"),
            "programmes": programmes,
        },
        "narrative": {
            "scaleHeading": require(node_text(find_class(viral, "pw2-viral-header"), exclude_classes={"pw2-tooltip"}), language, "narrative.scaleHeading"),
            "scaleTitle": require(node_text(find_class(viral, "pw2-viral-title"), exclude_classes={"pw2-tooltip"}), language, "narrative.scaleTitle"),
            "day": require(day_label, language, "narrative.day"),
            "month": require(month_label, language, "narrative.month"),
            "year": require(year_label, language, "narrative.year"),
            "missionHeading": require(node_text(find_class(mission_block, "pw2-pf-m-header"), exclude_classes={"pw2-tooltip"}), language, "narrative.missionHeading"),
            "missionCopy": require(node_text(find_class(mission_block, "pw2-pf-m-desc"), exclude_classes={"pw2-tooltip"}), language, "narrative.missionCopy"),
            "impactTitle": require(node_text(find_class(mission_block, "pw2-micro-title"), exclude_classes={"pw2-tooltip"}), language, "narrative.impactTitle"),
            "impact": require(node_text(find_class(mission_block, "pw2-micro-text"), exclude_classes={"pw2-tooltip"}), language, "narrative.impact"),
            "cta": require(node_text(cta, exclude_classes={"pw2-tooltip"}), language, "narrative.cta"),
            "ctaHref": cta.attrs.get("href", "") if cta else "",
            "philosophyTitle": require(node_text(find_tag(philosophy, "h2"), exclude_classes={"pw2-tooltip"}), language, "narrative.philosophyTitle"),
            "philosophyCopy": require(node_text(philosophy_intros[0], exclude_classes={"pw2-tooltip"}) if philosophy_intros else "", language, "narrative.philosophyCopy"),
            "quote": require(node_text(quote, exclude_classes={"pw2-tooltip"}), language, "narrative.quote"),
            "quoteSource": require(node_text(quote_source, exclude_classes={"pw2-tooltip"}), language, "narrative.quoteSource"),
            "closing": require(node_text(philosophy_intros[-1], exclude_classes={"pw2-tooltip"}) if philosophy_intros else "", language, "narrative.closing"),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="unified/legacy-copy.json")
    args = parser.parse_args()

    route_doc = json.loads(ROUTES.read_text(encoding="utf-8"))
    languages = route_doc.get("languages", {})
    if not languages:
        raise SystemExit("data/routes.json: no languages")

    result = {
        "schemaVersion": 1,
        "status": "generated-from-legacy-source",
        "purpose": "Exact migration copy extracted from the existing localized calculators; not a methodology endorsement.",
        "languages": {},
    }

    for language, meta in languages.items():
        source = ROOT / meta["source"]
        if not source.is_file():
            raise SystemExit(f"{language}: missing source {meta['source']}")
        result["languages"][language] = extract(language, source)

    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted legacy locale copy for {len(result['languages'])} languages -> {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
