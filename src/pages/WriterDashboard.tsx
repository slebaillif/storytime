import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import type { Story } from '../types';

export default function WriterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadStories = () => {
    if (!user) return;
    const q = query(
      collection(db, 'stories'),
      where('authorId', '==', user.uid)
    );
    getDocs(q).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story));
      list.sort((a, b) => {
        const ta = a.updatedAt?.seconds ?? 0;
        const tb = b.updatedAt?.seconds ?? 0;
        return tb - ta;
      });
      setStories(list);
      setLoading(false);
    });
  };

  useEffect(() => { loadStories(); }, [user]);

  const createStory = async () => {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    const ref = await addDoc(collection(db, 'stories'), {
      title: newTitle.trim(),
      description: newDesc.trim(),
      authorId: user.uid,
      authorName: user.displayName ?? 'Anonymous',
      authorPhoto: user.photoURL ?? '',
      isPublished: false,
      startNodeId: '',
      nodes: [],
      edges: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setCreating(false);
    setShowForm(false);
    setNewTitle('');
    setNewDesc('');
    navigate(`/write/${ref.id}`);
  };

  const deleteStory = async (id: string) => {
    if (!confirm('Delete this story? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'stories', id));
    setStories((s) => s.filter((x) => x.id !== id));
  };

  return (
    <div className="page dashboard-page">
      <div className="dashboard-header">
        <h1>My Stories</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New Story
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Story</h2>
            <label>
              Title
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="The Lost Kingdom..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createStory()}
              />
            </label>
            <label>
              Description <span className="text-muted">(optional)</span>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="A short summary for readers..."
                rows={3}
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createStory} disabled={creating || !newTitle.trim()}>
                {creating ? 'Creating...' : 'Create & Edit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading your stories...</p>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <p>You haven't written any stories yet.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Write your first story</button>
        </div>
      ) : (
        <div className="story-list">
          {stories.map((story) => (
            <div key={story.id} className="story-list-item">
              <div className="story-list-info">
                <h3>{story.title || 'Untitled'}</h3>
                <p className="text-muted">{story.description || 'No description.'}</p>
                <div className="story-list-meta">
                  <span className={`badge ${story.isPublished ? 'badge-success' : 'badge-muted'}`}>
                    {story.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <span className="text-muted">{story.nodes?.length ?? 0} passages</span>
                </div>
              </div>
              <div className="story-list-actions">
                <button className="btn btn-ghost" onClick={() => navigate(`/write/${story.id}`)}>
                  Edit
                </button>
                {story.isPublished && (
                  <button className="btn btn-ghost" onClick={() => navigate(`/story/${story.id}`)}>
                    Read
                  </button>
                )}
                <button className="btn btn-danger-ghost" onClick={() => deleteStory(story.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
