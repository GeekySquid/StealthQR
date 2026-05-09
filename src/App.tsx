import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Home from './pages/Home';
import Download from './pages/Download';
import { AnimatedCursor } from './components/AnimatedCursor';

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedCursor />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/d/:id" element={<Download />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
