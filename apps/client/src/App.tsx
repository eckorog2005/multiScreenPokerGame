import { BrowserRouter, Route, Routes } from 'react-router';
import Landing from './screens/Landing.tsx';
import PlayerDevice from './screens/PlayerDevice.tsx';
import Table from './screens/Table.tsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/table" element={<Table />} />
        <Route path="/play" element={<PlayerDevice />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
