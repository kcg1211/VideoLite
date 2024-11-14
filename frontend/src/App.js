//frontend/src/App.js

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Upload from './components/Upload';
import History from './components/History'; // Import the History component
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/home" element={<Home />} />
        <Route path="/uploads" element={<Upload />} />
        <Route path="/history" element={<History />} /> {/* Add History route */}
      </Routes>
    </Router>
  );
}

export default App;
