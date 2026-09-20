const get = (value, key) => {
    if (typeof value !== 'object' || value === null)
        return undefined;
    return value[key];
};
const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const px = (value) => {
    const numeric = finiteNumber(value);
    return numeric === undefined ? undefined : `${Math.round(numeric * 100) / 100}px`;
};
const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeCssString = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
function color(value) {
    const red = finiteNumber(get(value, 'r'));
    const green = finiteNumber(get(value, 'g'));
    const blue = finiteNumber(get(value, 'b'));
    if (red === undefined || green === undefined || blue === undefined)
        return undefined;
    return `#${[red, green, blue].map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
function snapshotPaints(value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap((paint) => {
        if (get(paint, 'visible') === false || get(paint, 'type') !== 'SOLID')
            return [];
        const paintColor = color(get(paint, 'color'));
        if (!paintColor)
            return [];
        const opacity = finiteNumber(get(paint, 'opacity'));
        return [{ color: paintColor, ...(opacity === undefined ? {} : { opacity }) }];
    });
}
function snapshotEffects(value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap((effect) => {
        if (get(effect, 'visible') === false)
            return [];
        const type = get(effect, 'type');
        if (typeof type !== 'string')
            return [];
        const offset = get(effect, 'offset');
        const effectColor = color(get(effect, 'color'));
        return [{
                type,
                radius: finiteNumber(get(effect, 'radius')),
                offsetX: finiteNumber(get(offset, 'x')),
                offsetY: finiteNumber(get(offset, 'y')),
                ...(effectColor ? { color: effectColor } : {}),
            }];
    });
}
function snapshotLineHeight(value) {
    const unit = get(value, 'unit');
    const amount = finiteNumber(get(value, 'value'));
    if (unit === 'AUTO')
        return 'normal';
    if (unit === 'PIXELS' && amount !== undefined)
        return `${Math.round(amount * 100) / 100}px`;
    if ((unit === 'INTRINSIC_%' || unit === 'PERCENT') && amount !== undefined)
        return `${Math.round(amount * 100) / 100}%`;
    return undefined;
}
export async function buildSnapshot(node, includeChildren) {
    const record = node;
    const snapshot = {
        name: node.name,
        type: node.type,
        width: finiteNumber(node.width),
        height: finiteNumber(node.height),
        widthBehavior: typeof record.layoutSizingHorizontal === 'string' ? record.layoutSizingHorizontal : undefined,
        heightBehavior: typeof record.layoutSizingVertical === 'string' ? record.layoutSizingVertical : undefined,
        layoutMode: typeof record.layoutMode === 'string' ? record.layoutMode : undefined,
        layoutWrap: typeof record.layoutWrap === 'string' ? record.layoutWrap : undefined,
        primaryAxisAlignItems: typeof record.primaryAxisAlignItems === 'string' ? record.primaryAxisAlignItems : undefined,
        counterAxisAlignItems: typeof record.counterAxisAlignItems === 'string' ? record.counterAxisAlignItems : undefined,
        itemSpacing: finiteNumber(record.itemSpacing),
        counterAxisSpacing: finiteNumber(record.counterAxisSpacing),
        paddingTop: finiteNumber(record.paddingTop),
        paddingRight: finiteNumber(record.paddingRight),
        paddingBottom: finiteNumber(record.paddingBottom),
        paddingLeft: finiteNumber(record.paddingLeft),
        layoutPositioning: typeof record.layoutPositioning === 'string' ? record.layoutPositioning : undefined,
        fills: snapshotPaints(record.fills),
        strokes: snapshotPaints(record.strokes),
        strokeWeight: finiteNumber(record.strokeWeight),
        cornerRadius: finiteNumber(record.cornerRadius),
        opacity: finiteNumber(record.opacity),
        effects: snapshotEffects(record.effects),
        children: [],
    };
    if (node.type === 'TEXT') {
        const textNode = record;
        const fontName = get(textNode.fontName, 'family');
        const fontStyle = get(textNode.fontName, 'style');
        snapshot.characters = typeof textNode.characters === 'string' ? textNode.characters : undefined;
        snapshot.fontFamily = typeof fontName === 'string' ? fontName : undefined;
        snapshot.fontStyle = typeof fontStyle === 'string' ? fontStyle : undefined;
        snapshot.fontWeight = finiteNumber(textNode.fontWeight);
        snapshot.fontSize = finiteNumber(textNode.fontSize);
        snapshot.lineHeight = snapshotLineHeight(textNode.lineHeight);
        const letterSpacing = textNode.letterSpacing;
        const letterValue = finiteNumber(get(letterSpacing, 'value'));
        if (letterValue !== undefined)
            snapshot.letterSpacing = get(letterSpacing, 'unit') === 'PIXELS' ? `${letterValue}px` : `${letterValue}%`;
        snapshot.textAlignHorizontal = typeof textNode.textAlignHorizontal === 'string' ? textNode.textAlignHorizontal : undefined;
        snapshot.textAlignVertical = typeof textNode.textAlignVertical === 'string' ? textNode.textAlignVertical : undefined;
    }
    if (includeChildren && 'children' in node) {
        const children = node.children;
        for (const child of children)
            snapshot.children.push(await buildSnapshot(child, true));
    }
    return snapshot;
}
function collectNodes(root) {
    const nodes = [];
    const visit = (node) => {
        nodes.push(node);
        node.children.forEach(visit);
    };
    visit(root);
    return nodes;
}
function createClassMap(root) {
    const counts = new Map();
    const classes = new Map();
    for (const node of collectNodes(root)) {
        const base = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'layer';
        const count = (counts.get(base) ?? 0) + 1;
        counts.set(base, count);
        classes.set(node, count === 1 ? base : `${base}-${count}`);
    }
    return classes;
}
function htmlElement(node) {
    return node.type === 'TEXT' ? 'span' : 'div';
}
function renderHtmlNode(node, classes, depth) {
    const indent = '  '.repeat(depth);
    const element = htmlElement(node);
    const className = classes.get(node) ?? 'layer';
    const opening = `${indent}<${element} class="${className}">`;
    const closing = `${indent}</${element}>`;
    if (node.type === 'TEXT' && node.characters && node.children.length === 0)
        return [`${opening}${escapeHtml(node.characters)}</${element}>`];
    const result = [opening];
    if (node.type === 'TEXT' && node.characters)
        result.push(`${'  '.repeat(depth + 1)}${escapeHtml(node.characters)}`);
    node.children.forEach((child) => result.push(...renderHtmlNode(child, classes, depth + 1)));
    result.push(closing);
    return result;
}
export function formatHtml(root) {
    const classes = createClassMap(root);
    return ['<!-- HTML -->', ...renderHtmlNode(root, classes, 0)].join('\n');
}
function alignment(value, axis) {
    if (!value)
        return undefined;
    if (value === 'SPACE_BETWEEN')
        return axis === 'primary' ? 'space-between' : undefined;
    if (value === 'CENTER')
        return 'center';
    if (value === 'MAX')
        return axis === 'primary' ? 'flex-end' : 'flex-end';
    if (value === 'MIN')
        return 'flex-start';
    if (value === 'BASELINE')
        return 'baseline';
    return undefined;
}
function padding(node) {
    const values = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
    if (values.some((value) => value === undefined))
        return undefined;
    const [top, right, bottom, left] = values;
    const formatted = [top, right, bottom, left].map((value) => `${value}px`);
    if (top === right && right === bottom && bottom === left)
        return `${top}px`;
    if (top === bottom && right === left)
        return `${top}px ${right}px`;
    if (right === left)
        return `${top}px ${right}px ${bottom}px`;
    return formatted.join(' ');
}
function addDeclaration(declarations, property, value) {
    if (value !== undefined && value !== '')
        declarations.push(`  ${property}: ${value};`);
}
function nodeDeclarations(node) {
    const declarations = [];
    addDeclaration(declarations, 'width', node.widthBehavior === 'FILL' ? '100%' : px(node.width));
    addDeclaration(declarations, 'height', node.heightBehavior === 'FILL' ? '100%' : px(node.height));
    if (node.layoutMode && node.layoutMode !== 'NONE') {
        addDeclaration(declarations, 'display', 'flex');
        addDeclaration(declarations, 'flex-direction', node.layoutMode === 'HORIZONTAL' ? 'row' : 'column');
        if (node.layoutWrap === 'WRAP')
            addDeclaration(declarations, 'flex-wrap', 'wrap');
        addDeclaration(declarations, 'justify-content', alignment(node.primaryAxisAlignItems, 'primary'));
        addDeclaration(declarations, 'align-items', alignment(node.counterAxisAlignItems, 'counter'));
        addDeclaration(declarations, 'gap', px(node.itemSpacing));
        if (node.counterAxisSpacing !== undefined && node.counterAxisSpacing !== node.itemSpacing)
            addDeclaration(declarations, 'row-gap', px(node.counterAxisSpacing));
        addDeclaration(declarations, 'padding', padding(node));
    }
    if (node.layoutPositioning === 'ABSOLUTE')
        addDeclaration(declarations, 'position', 'absolute');
    const fill = (node.fills ?? [])[0];
    if (fill) {
        addDeclaration(declarations, 'background', fill.color);
        if (fill.opacity !== undefined && fill.opacity < 1)
            addDeclaration(declarations, 'opacity', `${Math.round(fill.opacity * 100) / 100}`);
    }
    const stroke = (node.strokes ?? [])[0];
    if (stroke && node.strokeWeight !== undefined)
        addDeclaration(declarations, 'border', `${px(node.strokeWeight)} solid ${stroke.color}`);
    addDeclaration(declarations, 'border-radius', px(node.cornerRadius));
    const shadow = (node.effects ?? []).find((effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW');
    if (shadow)
        addDeclaration(declarations, 'box-shadow', `${shadow.offsetX ?? 0}px ${shadow.offsetY ?? 0}px ${px(shadow.radius) ?? '0px'} ${shadow.color ?? '#000000'}`);
    const blur = (node.effects ?? []).find((effect) => effect.type === 'BACKGROUND_BLUR' || effect.type === 'LAYER_BLUR');
    if (blur)
        addDeclaration(declarations, 'filter', `blur(${px(blur.radius) ?? '0px'})`);
    if (node.type === 'TEXT') {
        addDeclaration(declarations, 'font-family', node.fontFamily ? `"${escapeCssString(node.fontFamily)}"` : undefined);
        addDeclaration(declarations, 'font-size', px(node.fontSize));
        addDeclaration(declarations, 'font-weight', node.fontWeight);
        addDeclaration(declarations, 'font-style', node.fontStyle?.toLowerCase() === 'italic' ? 'italic' : undefined);
        addDeclaration(declarations, 'line-height', node.lineHeight);
        addDeclaration(declarations, 'letter-spacing', node.letterSpacing);
        addDeclaration(declarations, 'text-align', node.textAlignHorizontal?.toLowerCase());
        addDeclaration(declarations, 'vertical-align', node.textAlignVertical?.toLowerCase());
        if ((node.fills ?? [])[0])
            addDeclaration(declarations, 'color', (node.fills ?? [])[0].color);
    }
    return declarations;
}
export function formatCss(root) {
    const classes = createClassMap(root);
    const blocks = collectNodes(root).map((node) => {
        const declarations = nodeDeclarations(node);
        const selector = `.${classes.get(node) ?? 'layer'}`;
        return declarations.length ? `${selector} {\n${declarations.join('\n')}\n}` : `${selector} {}`;
    });
    return ['/* CSS */', ...blocks].join('\n\n');
}
export function formatHtmlCss(root) {
    const html = formatHtml(root);
    const css = formatCss(root);
    return { html, css, combined: `${html}\n\n${css}` };
}
