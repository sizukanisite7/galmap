import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import MapPage from './pages/MapPage'
import Trash from './pages/Trash'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/m/:mapId" element={<MapPage />} />
        <Route path="/m/:mapId/trash" element={<Trash />} />
      </Routes>
    </BrowserRouter>
  )
}
