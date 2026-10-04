import type { PassageRef } from '../../domain/references/types.js';

export interface PhraseNode {
  id: string;
  tokenIds: string[];
  label?: string;
  relation?: string;
  children: PhraseNode[];
}

export interface PhrasingDocument {
  id: string;
  studyId: string;
  passage: PassageRef;
  roots: PhraseNode[];
  updatedAt: number;
}

export function findPhraseNode(nodes: PhraseNode[], id: string): PhraseNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findPhraseNode(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

export function updatePhraseNode(nodes: PhraseNode[], id: string, patch: Partial<Omit<PhraseNode,'id'|'children'>>): PhraseNode[] {
  return nodes.map((node) => node.id === id
    ? { ...node, ...structuredClone(patch) }
    : { ...node, children: updatePhraseNode(node.children, id, patch) });
}

export function indentPhrase(nodes: PhraseNode[], id: string): PhraseNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index > 0) {
    const target = nodes[index]!;
    const previous = nodes[index - 1]!;
    return [
      ...nodes.slice(0, index - 1),
      { ...previous, children: [...previous.children, target] },
      ...nodes.slice(index + 1),
    ];
  }
  if (index === 0) return nodes;
  return nodes.map((node) => ({ ...node, children: indentPhrase(node.children, id) }));
}

export function outdentPhrase(nodes: PhraseNode[], id: string): PhraseNode[] {
  for (let parentIndex = 0; parentIndex < nodes.length; parentIndex += 1) {
    const parent = nodes[parentIndex]!;
    const childIndex = parent.children.findIndex((child) => child.id === id);
    if (childIndex >= 0) {
      const target = parent.children[childIndex]!;
      const updatedParent = { ...parent, children: [...parent.children.slice(0, childIndex), ...parent.children.slice(childIndex + 1)] };
      return [...nodes.slice(0, parentIndex), updatedParent, target, ...nodes.slice(parentIndex + 1)];
    }
    const updatedChildren = outdentPhrase(parent.children, id);
    if (updatedChildren !== parent.children) return nodes.map((node, index) => index === parentIndex ? { ...parent, children: updatedChildren } : node);
  }
  return nodes;
}

export function splitPhraseNode(nodes: PhraseNode[], id: string, afterTokenId: string, newNodeId: string): PhraseNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const target = nodes[index]!;
    if (target.children.length) throw new Error('Split nested phrase children before splitting their parent');
    const tokenIndex = target.tokenIds.indexOf(afterTokenId);
    if (tokenIndex < 0 || tokenIndex >= target.tokenIds.length - 1) return nodes;
    const left: PhraseNode = { ...target, tokenIds: target.tokenIds.slice(0, tokenIndex + 1) };
    const right: PhraseNode = { id: newNodeId, tokenIds: target.tokenIds.slice(tokenIndex + 1), children: [] };
    return [...nodes.slice(0, index), left, right, ...nodes.slice(index + 1)];
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const children = splitPhraseNode(node.children, id, afterTokenId, newNodeId);
    if (children !== node.children) return nodes.map((item, j) => j === i ? { ...node, children } : item);
  }
  return nodes;
}

export function mergePhraseWithPrevious(nodes: PhraseNode[], id: string): PhraseNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index > 0) {
    const previous = nodes[index - 1]!;
    const target = nodes[index]!;
    if (previous.children.length || target.children.length) return nodes;
    const merged: PhraseNode = { ...previous, tokenIds: [...previous.tokenIds, ...target.tokenIds] };
    return [...nodes.slice(0, index - 1), merged, ...nodes.slice(index + 1)];
  }
  if (index === 0) return nodes;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const children = mergePhraseWithPrevious(node.children, id);
    if (children !== node.children) return nodes.map((item, j) => j === i ? { ...node, children } : item);
  }
  return nodes;
}
