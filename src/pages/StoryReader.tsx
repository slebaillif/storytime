import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Story, StoryNodeRecord, StoryEdgeRecord } from '../types';

export default function StoryReader() {
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storyId) return;
    getDoc(doc(db, 'stories', storyId)).then((snap) => {
      if (!snap.exists()) {
        setError('Story not found.');
      } else {
        const data = { id: snap.id, ...snap.data() } as Story;
        if (!data.isPublished) {
          setError('This story is not published yet.');
        } else {
          setStory(data);
          setCurrentNodeId(data.startNodeId || data.nodes?.[0]?.id || '');
        }
      }
      setLoading(false);
    });
  }, [storyId]);

  const currentNode: StoryNodeRecord | undefined = story?.nodes.find((n) => n.id === currentNodeId);
  const choices: StoryEdgeRecord[] = story?.edges.filter((e) => e.source === currentNodeId) ?? [];

  const makeChoice = (targetNodeId: string) => {
    setHistory((h) => [...h, currentNodeId]);
    setCurrentNodeId(targetNodeId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setCurrentNodeId(prev);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const restart = () => {
    setHistory([]);
    setCurrentNodeId(story?.startNodeId || story?.nodes?.[0]?.id || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="loading-screen">Loading story...</div>;
  if (error) return (
    <div className="page">
      <p className="error-msg">{error}</p>
      <Link to="/" className="btn btn-ghost">Back to home</Link>
    </div>
  );
  if (!story || !currentNode) return (
    <div className="page">
      <p className="error-msg">This story has no content yet.</p>
      <Link to="/" className="btn btn-ghost">Back to home</Link>
    </div>
  );

  const isEnding = currentNode.data.isEnding || choices.length === 0;
  const imageUrl = currentNode.data.imageUrl;

  const textAndChoices = (
    <>
      <div className="passage">
        <h2 className="passage-title">{currentNode.data.title}</h2>
        <div className="passage-text">
          {currentNode.data.content.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      <div className="reader-footer">
        {isEnding ? (
          <div className="ending">
            <p className="ending-label">— The End —</p>
            <button className="btn btn-primary" onClick={restart}>Read again</button>
          </div>
        ) : (
          <div className="choices">
            {choices.map((edge) => {
              const target = story.nodes.find((n) => n.id === edge.target);
              return (
                <button
                  key={edge.id}
                  className="choice-btn"
                  onClick={() => makeChoice(edge.target)}
                >
                  {edge.label || `Go to ${target?.data.title || 'next passage'}`}
                </button>
              );
            })}
          </div>
        )}
        {history.length > 0 && (
          <button className="btn btn-ghost back-btn" onClick={goBack}>
            ← Go back
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="reader-page">
      <div className="reader-header">
        <Link to="/" className="btn btn-ghost reader-home-btn">← Home</Link>
        <span className="reader-story-title">{story.title}</span>
        <button className="btn btn-ghost" onClick={restart}>Restart</button>
      </div>

      {imageUrl ? (
        <div className="reader-two-col">
          <div className="reader-image-col">
            <img src={imageUrl} alt={currentNode.data.title} />
          </div>
          <div className="reader-text-col">
            {textAndChoices}
          </div>
        </div>
      ) : (
        <div className="reader-content">
          {textAndChoices}
        </div>
      )}
    </div>
  );
}
