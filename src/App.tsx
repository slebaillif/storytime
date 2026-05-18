import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import WriterDashboard from './pages/WriterDashboard';
import StoryEditor from './pages/StoryEditor';
import StoryReader from './pages/StoryReader';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="story/:storyId" element={<StoryReader />} />
          <Route
            path="write"
            element={<ProtectedRoute><WriterDashboard /></ProtectedRoute>}
          />
        </Route>
        <Route
          path="write/:storyId"
          element={<ProtectedRoute><StoryEditor /></ProtectedRoute>}
        />
      </Routes>
    </BrowserRouter>
  );
}
