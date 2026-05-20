import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState,
  Handle, Position,
  type Connection, type Node, type Edge,
  type NodeProps, type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import type { Story, NodeData, NodeStorageData, StoryNodeRecord, StoryEdgeRecord } from '../types';

// ─── Custom node component ───────────────────────────────────────────────────

function StoryNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const classList = [
    'sn-card',
    selected ? 'sn-selected' : '',
    d.isStart ? 'sn-start' : '',
    d.isEnding ? 'sn-ending' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classList}>
      <Handle type="target" position={Position.Top} className="sn-handle" />
      {d.imageUrl && (
        <div className="sn-image">
          <img src={d.imageUrl} alt="" />
        </div>
      )}
      <div className="sn-badges">
        {d.isStart && <span className="sn-badge sn-badge-start">START</span>}
        {d.isEnding && <span className="sn-badge sn-badge-end">END</span>}
      </div>
      <div className="sn-title">{d.title || 'Untitled passage'}</div>
      <div className="sn-preview">
        {d.content
          ? d.content.length > 90 ? d.content.slice(0, 90) + '…' : d.content
          : <em>No content yet</em>}
      </div>
      <Handle type="source" position={Position.Bottom} className="sn-handle" />
    </div>
  );
}

const nodeTypes = { storyNode: StoryNode };

// ─── Node editor side panel ──────────────────────────────────────────────────

interface NodeEditorProps {
  node: Node;
  storyId: string;
  outgoingEdges: Edge[];
  allNodes: Node[];
  isStart: boolean;
  onUpdate: (updates: Partial<NodeData>) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onSetStart: () => void;
  onDelete: () => void;
}

function NodeEditor({
  node, storyId, outgoingEdges, allNodes, isStart,
  onUpdate, onUpdateEdgeLabel, onDeleteEdge, onSetStart, onDelete,
}: NodeEditorProps) {
  const d = node.data as NodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const path = `stories/${storyId}/${node.id}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      onUpdate({ imageUrl: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="node-editor">
      <div className="ne-section">
        <label className="ne-label">Title</label>
        <input
          className="ne-input"
          value={d.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Passage title..."
        />
      </div>
      <div className="ne-section">
        <label className="ne-label">Content</label>
        <textarea
          className="ne-textarea"
          value={d.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Write your story here..."
          rows={8}
        />
      </div>

      <div className="ne-section">
        <label className="ne-label">Image</label>
        {d.imageUrl ? (
          <div className="ne-image-preview">
            <img src={d.imageUrl} alt="Passage" />
            <button className="ne-remove-image" onClick={() => onUpdate({ imageUrl: '' })}>
              Remove image
            </button>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              className={`ne-upload-btn ${uploading ? 'ne-uploading' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : '+ Upload image'}
            </button>
            {uploadError && <p className="ne-upload-error">{uploadError}</p>}
          </>
        )}
      </div>

      <div className="ne-section">
        <label className="ne-checkbox">
          <input
            type="checkbox"
            checked={d.isEnding}
            onChange={(e) => onUpdate({ isEnding: e.target.checked })}
          />
          Mark as ending
        </label>
      </div>

      {outgoingEdges.length > 0 && (
        <div className="ne-section">
          <label className="ne-label">Choices</label>
          {outgoingEdges.map((edge) => {
            const target = allNodes.find((n) => n.id === edge.target);
            return (
              <div key={edge.id} className="ne-choice">
                <input
                  className="ne-input ne-choice-input"
                  value={(edge.data?.label as string) ?? (edge.label as string) ?? ''}
                  onChange={(e) => onUpdateEdgeLabel(edge.id, e.target.value)}
                  placeholder="Choice label..."
                />
                <span className="ne-choice-target">
                  → {(target?.data as NodeData)?.title || 'Untitled'}
                </span>
                <button className="ne-delete-edge" onClick={() => onDeleteEdge(edge.id)} title="Remove choice">×</button>
              </div>
            );
          })}
          <p className="ne-hint">Draw arrows on the canvas to add more choices.</p>
        </div>
      )}

      <div className="ne-actions">
        {!isStart && (
          <button className="btn btn-ghost ne-btn" onClick={onSetStart}>
            Set as start
          </button>
        )}
        <button className="btn btn-danger-ghost ne-btn" onClick={onDelete}>
          Delete passage
        </button>
      </div>
    </div>
  );
}

// ─── Main editor page ─────────────────────────────────────────────────────────

function nodeToRecord(n: Node): StoryNodeRecord {
  const d = n.data as NodeData;
  const data: NodeStorageData = { title: d.title, content: d.content, isEnding: d.isEnding };
  if (d.imageUrl) data.imageUrl = d.imageUrl;
  return { id: n.id, type: n.type ?? 'storyNode', position: n.position, data };
}

function truncateLabel(label: string) {
  return label.length > 20 ? label.slice(0, 20) + '…' : label;
}

function edgeToRecord(e: Edge): StoryEdgeRecord {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: (e.data?.label as string) ?? (e.label as string) ?? '',
  };
}

function recordToNode(r: StoryNodeRecord, startNodeId: string): Node {
  const data: NodeData = { ...r.data, isStart: r.id === startNodeId };
  return { id: r.id, type: 'storyNode', position: r.position, data };
}

function recordToEdge(r: StoryEdgeRecord): Edge {
  return {
    id: r.id,
    source: r.source,
    target: r.target,
    label: truncateLabel(r.label),
    data: { label: r.label },
    type: 'smoothstep',
    animated: false,
  };
}

export default function StoryEditor() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Refs so doSave always reads the latest values without stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const storyRef = useRef(story);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { storyRef.current = story; }, [story]);

  // One-time load (getDoc avoids onSnapshot re-firing after every save)
  useEffect(() => {
    if (!storyId) return;
    getDoc(doc(db, 'stories', storyId)).then((snap) => {
      if (!snap.exists()) { navigate('/write'); return; }
      const data = { id: snap.id, ...snap.data() } as Story;
      setStory(data);
      setNodes((data.nodes ?? []).map((r) => recordToNode(r, data.startNodeId)));
      setEdges((data.edges ?? []).map(recordToEdge));
      setLoading(false);
    });
  }, [storyId]);

  // Save always reads from refs — no stale closure issues
  const doSave = useCallback(async () => {
    const currentStory = storyRef.current;
    if (!storyId || !currentStory) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        title: currentStory.title,
        description: currentStory.description,
        isPublished: currentStory.isPublished,
        startNodeId: currentStory.startNodeId,
        nodes: nodesRef.current.map(nodeToRecord),
        edges: edgesRef.current.map(edgeToRecord),
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }, [storyId]);

  const scheduleSave = useCallback(() => {
    setSaved(false);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = undefined;
      doSave();
    }, 2000);
  }, [doSave]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        clearTimeout(saveTimerRef.current);
        doSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doSave]);

  const updateStoryMeta = (updates: Partial<Story>) => {
    setStory((s) => s ? { ...s, ...updates } : s);
    scheduleSave();
  };

  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `edge-${Date.now()}`,
      label: 'Continue...',
      data: { label: 'Continue...' },
      type: 'smoothstep',
    } as Edge;
    setEdges((eds) => addEdge(newEdge, eds));
    scheduleSave();
  }, [scheduleSave]);

  const handleNodesChange: typeof onNodesChange = (changes) => {
    onNodesChange(changes);
    const mutating = changes.some((c) => c.type !== 'select' && c.type !== 'dimensions');
    if (mutating) scheduleSave();
  };

  const handleEdgesChange: typeof onEdgesChange = (changes) => {
    onEdgesChange(changes);
    const mutating = changes.some((c) => c.type !== 'select');
    if (mutating) scheduleSave();
  };

  const addNode = () => {
    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'storyNode',
      position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: {
        title: 'New passage',
        content: '',
        isEnding: false,
        isStart: nodes.length === 0,
      } as NodeData,
    };
    setNodes((nds) => {
      const updated = [...nds, newNode];
      return updated;
    });
    if (nodes.length === 0) {
      setStory((s) => s ? { ...s, startNodeId: id } : s);
    }
    setSelectedNodeId(id);
    scheduleSave();
  };

  const updateSelectedNodeData = (updates: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...updates } } : n
      )
    );
    scheduleSave();
  };

  const updateEdgeLabel = (edgeId: string, label: string) => {
    setEdges((eds) => eds.map((e) =>
      e.id === edgeId ? { ...e, label: truncateLabel(label), data: { ...e.data, label } } : e
    ));
    scheduleSave();
  };

  const deleteEdge = (edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    scheduleSave();
  };

  const setAsStart = () => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, isStart: n.id === selectedNodeId } as NodeData }))
    );
    updateStoryMeta({ startNodeId: selectedNodeId });
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    if (!confirm('Delete this passage?')) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    scheduleSave();
  };

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedNodeId(sel.length === 1 ? sel[0].id : null);
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const outgoingEdges = edges.filter((e) => e.source === selectedNodeId);

  if (loading) return <div className="loading-screen">Loading editor...</div>;

  return (
    <div className="editor-layout">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/write')}>← Back</button>
        <input
          className="toolbar-title-input"
          value={story?.title ?? ''}
          onChange={(e) => updateStoryMeta({ title: e.target.value })}
          placeholder="Story title..."
        />
        {saveError
          ? <span className="save-status save-error" title={saveError}>⚠ Save failed</span>
          : <span className="save-status">{saving ? 'Saving…' : saved ? 'Saved' : 'Unsaved'}</span>
        }
        <button
          className="btn btn-ghost"
          onClick={() => { clearTimeout(saveTimerRef.current); doSave(); }}
          disabled={saving}
        >
          Save
        </button>
        <button
          className={`btn ${story?.isPublished ? 'btn-success' : 'btn-primary'}`}
          onClick={() => updateStoryMeta({ isPublished: !story?.isPublished })}
        >
          {story?.isPublished ? 'Unpublish' : 'Publish'}
        </button>
        {story?.isPublished && (
          <button className="btn btn-ghost" onClick={() => window.open(`/story/${storyId}`, '_blank')}>
            Preview
          </button>
        )}
      </div>

      <div className="editor-body">
        {/* Canvas */}
        <div className="editor-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
          >
            <Background color="#2a2a40" gap={20} />
            <Controls />
            <Panel position="bottom-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, margin: 0 }}>
              <button className="add-node-fab" onClick={addNode}>+ Passage</button>
              <MiniMap nodeColor="#7c5cbf" maskColor="rgba(13,13,20,0.7)" style={{ position: 'static', margin: 0 }} />
            </Panel>
          </ReactFlow>
        </div>

        {/* Side panel */}
        <div className={`editor-panel ${selectedNode ? 'panel-open' : ''}`}>
          {selectedNode ? (
            <>
              <div className="panel-header">
                <span>Edit Passage</span>
                <button className="panel-close" onClick={() => setSelectedNodeId(null)}>×</button>
              </div>
              <NodeEditor
                node={selectedNode}
                storyId={storyId ?? ''}
                outgoingEdges={outgoingEdges}
                allNodes={nodes}
                isStart={story?.startNodeId === selectedNodeId}
                onUpdate={updateSelectedNodeData}
                onUpdateEdgeLabel={updateEdgeLabel}
                onDeleteEdge={deleteEdge}
                onSetStart={setAsStart}
                onDelete={deleteSelectedNode}
              />
            </>
          ) : (
            <div className="panel-empty">
              <p>Click a passage to edit it.</p>
              <p className="text-muted">Drag between passage handles to create choices.</p>
              <button className="btn btn-primary" onClick={addNode}>+ Add Passage</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
