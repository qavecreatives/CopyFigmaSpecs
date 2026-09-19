"use strict";
const get = (value, key) => {
    if (typeof value !== 'object' || value === null)
        return undefined;
    return value[key];
};
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const number = (value) => `${Math.round(Number(value) * 100) / 100}`;
const px = (value) => typeof value === 'number' && Number.isFinite(value) ? `${number(value)}px` : undefined;
const titleCase = (value) => value.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, letter) => ` ${letter.toUpperCase()}`).trim();
function color(value) {
    const channels = ['r', 'g', 'b'].map((key) => Math.round(Number(get(value, key)) * 255).toString(16).padStart(2, '0'));
    return `#${channels.join('').toUpperCase()}`;
}
function paint(value) {
    if (get(value, 'visible') === false)
        return undefined;
    const type = get(value, 'type');
    if (type === 'SOLID') {
        const opacity = get(value, 'opacity');
        const result = color(get(value, 'color'));
        return hasValue(opacity) && Number(opacity) < 1 ? `${result} / ${number(Number(opacity) * 100)}%` : result;
    }
    return typeof type === 'string' ? titleCase(type) : 'Mixed';
}
function paints(value) {
    if (!Array.isArray(value))
        return undefined;
    const visible = value.map(paint).filter((item) => Boolean(item));
    return visible.length ? visible.join(', ') : undefined;
}
function textValue(value) {
    if (!hasValue(value))
        return undefined;
    if (typeof value === 'object' && value !== null && get(value, 'mixed') === true)
        return 'Mixed';
    return String(value);
}
function lineHeight(style) {
    if (style.lineHeightUnit === 'AUTO')
        return 'Auto';
    if (style.lineHeightUnit === 'PIXELS')
        return px(style.lineHeightPx);
    if (style.lineHeightUnit === 'INTRINSIC_%' || style.lineHeightUnit === 'PERCENT')
        return `${number(style.lineHeightPercent)}%`;
    return undefined;
}
function add(lines, label, value) {
    if (hasValue(value))
        lines.push(`${label}: ${String(value)}`);
}
function formatEffect(effect) {
    if (get(effect, 'visible') === false)
        return undefined;
    const type = get(effect, 'type');
    if (type === 'BACKGROUND_BLUR' || type === 'LAYER_BLUR')
        return `${titleCase(String(type))}: ${px(get(effect, 'radius'))}`;
    if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
        const offset = get(effect, 'offset');
        const shadowColor = paint({ type: 'SOLID', color: get(effect, 'color') });
        return `${titleCase(String(type))}: ${number(get(offset, 'x'))}px ${number(get(offset, 'y'))}px ${px(get(effect, 'radius'))}${shadowColor ? ` ${shadowColor}` : ''}`;
    }
    return typeof type === 'string' ? titleCase(type) : undefined;
}
function nodeLines(node, includeIds) {
    const record = node;
    const lines = [];
    add(lines, 'Type', titleCase(node.type));
    if (includeIds)
        add(lines, 'Layer ID', node.id);
    add(lines, 'Width', px(node.width));
    add(lines, 'Height', px(node.height));
    add(lines, 'Width behavior', textValue(record.layoutSizingHorizontal));
    add(lines, 'Height behavior', textValue(record.layoutSizingVertical));
    add(lines, 'Min width', px(record.minWidth));
    add(lines, 'Max width', px(record.maxWidth));
    add(lines, 'Min height', px(record.minHeight));
    add(lines, 'Max height', px(record.maxHeight));
    const opacity = record.opacity;
    add(lines, 'Opacity', typeof opacity === 'number' && opacity < 1 ? `${number(opacity * 100)}%` : undefined);
    if (record.layoutMode && record.layoutMode !== 'NONE') {
        add(lines, 'Layout', titleCase(String(record.layoutMode)));
        add(lines, 'Wrap', record.layoutWrap === 'WRAP' ? 'Wrap' : record.layoutWrap === 'NO_WRAP' ? 'No wrap' : undefined);
        add(lines, 'Primary alignment', textValue(record.primaryAxisAlignItems));
        add(lines, 'Counter alignment', textValue(record.counterAxisAlignItems));
        add(lines, 'Gap', px(record.itemSpacing));
        add(lines, 'Row gap', px(record.counterAxisSpacing));
        const padding = [record.paddingTop, record.paddingRight, record.paddingBottom, record.paddingLeft].map(px);
        if (padding.every((value) => value !== undefined))
            add(lines, 'Padding', padding.join(' '));
    }
    if (record.layoutPositioning === 'ABSOLUTE')
        add(lines, 'Positioning', 'Absolute');
    add(lines, 'Fill', paints(record.fills));
    add(lines, 'Stroke', paints(record.strokes));
    add(lines, 'Stroke weight', px(record.strokeWeight));
    add(lines, 'Stroke alignment', textValue(record.strokeAlign));
    const radius = record.cornerRadius;
    if (radius === figma.mixed) {
        const corners = [record.topLeftRadius, record.topRightRadius, record.bottomRightRadius, record.bottomLeftRadius].map(px);
        add(lines, 'Corner radius', corners.every((value) => value !== undefined) ? corners.join(' / ') : 'Mixed');
    }
    else
        add(lines, 'Corner radius', px(radius));
    add(lines, 'Blend mode', textValue(record.blendMode));
    const effects = Array.isArray(record.effects) ? record.effects.map(formatEffect).filter((value) => Boolean(value)) : [];
    effects.forEach((effect) => lines.push(effect));
    if (node.type === 'TEXT') {
        add(lines, 'Characters', node.characters);
        const style = record.style && typeof record.style === 'object' ? record.style : {};
        const fontName = get(style, 'fontName');
        add(lines, 'Font', textValue(get(fontName, 'family')));
        add(lines, 'Style', textValue(get(fontName, 'style')));
        add(lines, 'Weight', textValue(style.fontWeight));
        add(lines, 'Size', px(style.fontSize));
        add(lines, 'Line height', lineHeight(style));
        const letterSpacing = style.letterSpacing;
        if (letterSpacing && letterSpacing.unit === 'PIXELS')
            add(lines, 'Letter spacing', px(letterSpacing.value));
        else if (letterSpacing && hasValue(letterSpacing.value))
            add(lines, 'Letter spacing', `${number(letterSpacing.value)}%`);
        add(lines, 'Horizontal alignment', textValue(style.textAlignHorizontal));
        add(lines, 'Vertical alignment', textValue(style.textAlignVertical));
        add(lines, 'Case', textValue(style.textCase));
        add(lines, 'Decoration', textValue(style.textDecoration));
        add(lines, 'Paragraph indent', px(style.paragraphIndent));
        add(lines, 'Paragraph spacing', px(style.paragraphSpacing));
        add(lines, 'Text trimming', textValue(style.leadingTrim ?? style.textTruncation));
    }
    return lines;
}
function renderNode(node, includeChildren, includeIds, prefix = '', isLast = true, isRoot = true) {
    const branch = isRoot ? '' : `${prefix}${isLast ? '└── ' : '├── '}`;
    const lineIndent = isRoot ? '' : `${prefix}${isLast ? '    ' : '│   '}`;
    const result = [`${branch}${node.name}`];
    result.push(...nodeLines(node, includeIds).map((line) => `${lineIndent}${line}`));
    if (includeChildren && 'children' in node) {
        const children = node.children;
        children.forEach((child, index) => {
            const childPrefix = isRoot ? '' : `${prefix}${isLast ? '    ' : '│   '}`;
            result.push(...renderNode(child, true, includeIds, childPrefix, index === children.length - 1, false));
        });
    }
    return result;
}
function sendSelection(includeChildren = true, includeIds = false) {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
        figma.ui.postMessage({ type: 'selection', name: '', specs: '', message: selection.length ? 'Select exactly one layer.' : 'Select a layer to inspect.' });
        return;
    }
    const node = selection[0];
    figma.ui.postMessage({ type: 'selection', name: node.name, specs: renderNode(node, includeChildren, includeIds).join('\n'), message: '' });
}
figma.showUI(__html__, { width: 420, height: 640 });
figma.on('selectionchange', () => sendSelection());
sendSelection();
figma.ui.onmessage = (message) => {
    if (message.type === 'refresh')
        sendSelection(message.includeChildren, message.includeIds);
    if (message.type === 'close')
        figma.closePlugin();
};
