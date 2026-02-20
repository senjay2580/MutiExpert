import { StickyNode } from './StickyNode';
import { TaskNode } from './TaskNode';
import { TextNode } from './TextNode';
import { ImageNode } from './ImageNode';

export const nodeTypes = {
  sticky: StickyNode,
  task: TaskNode,
  text: TextNode,
  image: ImageNode,
} as const;

export type BoardNodeType = keyof typeof nodeTypes;

export { StickyNode, TaskNode, TextNode, ImageNode };
