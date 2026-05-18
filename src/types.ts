import type { Timestamp } from 'firebase/firestore';

export interface NodeData extends Record<string, unknown> {
  title: string;
  content: string;
  isEnding: boolean;
  isStart: boolean;
}

export interface NodeStorageData {
  title: string;
  content: string;
  isEnding: boolean;
}

export interface StoryNodeRecord {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeStorageData;
}

export interface StoryEdgeRecord {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  isPublished: boolean;
  startNodeId: string;
  nodes: StoryNodeRecord[];
  edges: StoryEdgeRecord[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
