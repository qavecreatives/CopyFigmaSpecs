import { buildSnapshot, formatHtmlCss } from './formatters'

type PluginMessage =
  | { type: 'refresh'; includeChildren: boolean; includeIds: boolean }
  | { type: 'close' };

type AnyRecord = Record<string, unknown>;

const get = (value: unknown, key: string): unknown => {
  if (typeof value !== 'object' || value === null) return undefined;
  return (value as AnyRecord)[key];
};
const hasValue = (value: unknown): boolean => value !== undefined && value !== null && value !== '';
const number = (value: unknown): string => `${Math.round(Number(value) * 100) / 100}`;
const px = (value: unknown): string | undefined => typeof value === 'number' && Number.isFinite(value) ? `${number(value)}px` : undefined;
const titleCase = (value: string): string => value.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, letter) => ` ${letter.toUpperCase()}`).trim();

function color(value: unknown): string {
  const channels = ['r', 'g', 'b'].map((key) => Math.round(Number(get(value, key)) * 255).toString(16).padStart(2, '0'));
  return `#${channels.join('').toUpperCase()}`;
}

function paint(value: unknown): string | undefined {
  if (get(value, 'visible') === false) return undefined;
  const type = get(value, 'type');
  if (type === 'SOLID') {
    const opacity = get(value, 'opacity');
    const result = color(get(value, 'color'));
    return hasValue(opacity) && Number(opacity) < 1 ? `${result} / ${number(Number(opacity) * 100)}%` : result;
  }
  return typeof type === 'string' ? titleCase(type) : 'Mixed';
}

function paints(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const visible = value.map(paint).filter((item): item is string => Boolean(item));
  return visible.length ? visible.join(', ') : undefined;
}

function textValue(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  if (typeof value === 'object' && value !== null && get(value, 'mixed') === true) return 'Mixed';
  return String(value);
}

function lineHeight(style: AnyRecord): string | undefined {
  if (style.lineHeightUnit === 'AUTO') return 'Auto';
  if (style.lineHeightUnit === 'PIXELS') return px(style.lineHeightPx);
  if (style.lineHeightUnit === 'INTRINSIC_%' || style.lineHeightUnit === 'PERCENT') return `${number(style.lineHeightPercent)}%`;
  return undefined;
}

function add(lines: string[], label: string, value: unknown): void {
  if (hasValue(value)) lines.push(`${label}: ${String(value)}`);
}

async function appliedStyle(lines: string[], label: string, id: unknown, includeIds: boolean): Promise<void> {
  if (typeof id !== 'string' || !id) return;
  let style: unknown;
  try {
    const getStyleByIdAsync = (figma as unknown as { getStyleByIdAsync?: (styleId: string) => Promise<unknown> }).getStyleByIdAsync;
    style = await getStyleByIdAsync?.(id);
  } catch (_) {
    style = undefined;
  }
  const name = textValue(get(style, 'name'));
  add(lines, label, name ?? id);
  if (includeIds && name) add(lines, `${label} ID`, id);
}

function formatEffect(effect: unknown): string | undefined {
  if (get(effect, 'visible') === false) return undefined;
  const type = get(effect, 'type');
  if (type === 'BACKGROUND_BLUR' || type === 'LAYER_BLUR') return `${titleCase(String(type))}: ${px(get(effect, 'radius'))}`;
  if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
    const offset = get(effect, 'offset');
    const shadowColor = paint({ type: 'SOLID', color: get(effect, 'color') });
    return `${titleCase(String(type))}: ${number(get(offset, 'x'))}px ${number(get(offset, 'y'))}px ${px(get(effect, 'radius'))}${shadowColor ? ` ${shadowColor}` : ''}`;
  }
  return typeof type === 'string' ? titleCase(type) : undefined;
}

async function nodeLines(node: SceneNode, includeIds: boolean): Promise<string[]> {
  const record = node as unknown as AnyRecord;
  const lines: string[] = [];
  add(lines, 'Type', titleCase(node.type));
  if (includeIds) add(lines, 'Layer ID', node.id);
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
    if (padding.every((value): value is string => value !== undefined)) add(lines, 'Padding', padding.join(' '));
  }
  if (record.layoutPositioning === 'ABSOLUTE') add(lines, 'Positioning', 'Absolute');
  add(lines, 'Fill', paints(record.fills));
  add(lines, 'Stroke', paints(record.strokes));
  await appliedStyle(lines, 'Fill style', record.fillStyleId, includeIds);
  await appliedStyle(lines, 'Stroke style', record.strokeStyleId, includeIds);
  await appliedStyle(lines, 'Effect style', record.effectStyleId, includeIds);
  await appliedStyle(lines, 'Layout grid style', record.gridStyleId, includeIds);
  add(lines, 'Stroke weight', px(record.strokeWeight));
  add(lines, 'Stroke alignment', textValue(record.strokeAlign));
  const radius = record.cornerRadius;
  if (radius === figma.mixed) {
    const corners = [record.topLeftRadius, record.topRightRadius, record.bottomRightRadius, record.bottomLeftRadius].map(px);
    add(lines, 'Corner radius', corners.every((value): value is string => value !== undefined) ? corners.join(' / ') : 'Mixed');
  } else add(lines, 'Corner radius', px(radius));
  add(lines, 'Blend mode', textValue(record.blendMode));
  const effects = Array.isArray(record.effects) ? record.effects.map(formatEffect).filter((value): value is string => Boolean(value)) : [];
  effects.forEach((effect) => lines.push(effect));

  if (node.type === 'TEXT') {
    const textNode = node as unknown as AnyRecord;
    add(lines, 'Characters', textNode.characters);
    const fontName = textNode.fontName;
    add(lines, 'Font family', textValue(get(fontName, 'family')));
    add(lines, 'Font style', textValue(get(fontName, 'style')));
    add(lines, 'Weight', textValue(textNode.fontWeight));
    add(lines, 'Size', px(textNode.fontSize));
    const lineHeightData = textNode.lineHeight as AnyRecord | undefined;
    add(lines, 'Line height', lineHeightData ? lineHeight(lineHeightData) : undefined);
    const letterSpacing = textNode.letterSpacing as AnyRecord | undefined;
    if (letterSpacing && letterSpacing.unit === 'PIXELS') add(lines, 'Letter spacing', px(letterSpacing.value));
    else if (letterSpacing && hasValue(letterSpacing.value)) add(lines, 'Letter spacing', `${number(letterSpacing.value)}%`);
    add(lines, 'Horizontal alignment', textValue(textNode.textAlignHorizontal));
    add(lines, 'Vertical alignment', textValue(textNode.textAlignVertical));
    add(lines, 'Case', textValue(textNode.textCase));
    add(lines, 'Decoration', textValue(textNode.textDecoration));
    add(lines, 'Paragraph indent', px(textNode.paragraphIndent));
    add(lines, 'Paragraph spacing', px(textNode.paragraphSpacing));
    add(lines, 'Text trimming', textValue(textNode.leadingTrim ?? textNode.textTruncation));
    await appliedStyle(lines, 'Text style', textNode.textStyleId, includeIds);
  }
  return lines;
}

async function renderNode(node: SceneNode, includeChildren: boolean, includeIds: boolean, prefix = '', isLast = true, isRoot = true): Promise<string[]> {
  const branch = isRoot ? '' : prefix + (isLast ? '└── ' : '├── ');
  const lineIndent = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
  const result = [`${branch}${node.name}`];
  result.push(...(await nodeLines(node, includeIds)).map((line) => `${lineIndent}${line}`));
  if (includeChildren && 'children' in node) {
    const children = node.children as readonly SceneNode[];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
      result.push(...(await renderNode(child, true, includeIds, childPrefix, index === children.length - 1, false)));
    }
  }
  return result;
}

async function sendSelection(includeChildren = true, includeIds = false): Promise<void> {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    figma.ui.postMessage({ type: 'selection', name: '', specs: '', html: '', css: '', message: selection.length ? 'Select exactly one layer.' : 'Select a layer to inspect.' });
    return;
  }
  const node = selection[0];
  const htmlCss = formatHtmlCss(await buildSnapshot(node, includeChildren));
  figma.ui.postMessage({ type: 'selection', name: node.name, specs: (await renderNode(node, includeChildren, includeIds)).join('\n'), html: htmlCss.html, css: htmlCss.css, message: '' });
}

figma.showUI(__html__, { width: 420, height: 640 });
figma.on('selectionchange', () => { void sendSelection(); });
sendSelection();

figma.ui.onmessage = (message: PluginMessage) => {
  if (message.type === 'refresh') void sendSelection(message.includeChildren, message.includeIds);
  if (message.type === 'close') figma.closePlugin();
};
