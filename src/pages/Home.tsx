import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import type { Story } from '../types';

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'stories'),
      where('isPublished', '==', true)
    );
    getDocs(q).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story));
      list.sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
      setStories(list.slice(0, 20));
      setLoading(false);
    });
  }, []);

  return (
    <div className="page home-page">
      <section className="hero">
        <h1>Choose your own adventure</h1>
        <p>Read community stories or write your own branching tales.</p>
        {user ? (
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/write')}>
            Start writing
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={signIn}>
            Sign in to write
          </button>
        )}
      </section>

      <section className="stories-section">
        <h2>Published Stories</h2>
        {loading ? (
          <p className="text-muted">Loading stories...</p>
        ) : stories.length === 0 ? (
          <p className="text-muted">No published stories yet. Be the first to write one!</p>
        ) : (
          <div className="story-grid">
            {stories.map((story) => (
              <Link key={story.id} to={`/story/${story.id}`} className="story-card">
                <h3>{story.title || 'Untitled'}</h3>
                <p className="story-card-desc">{story.description || 'No description.'}</p>
                <span className="story-card-author">by {story.authorName}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
