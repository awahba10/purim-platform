import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Home from './components/Home';
import NewOrder from './components/NewOrder';
import AllOrders from './components/AllOrders';
import Materials from './components/Materials';
import Premade from './components/Premade';
import DeliveryCost from './components/DeliveryCost';
import Batches from './components/Batches';
import Products from './components/Products';
import Production from './components/Production';
import Financials from './components/Financials';
import { NAV } from './nav';

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar nav={NAV} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/orders" element={<AllOrders />} />
            <Route path="/orders/:id" element={<AllOrders />} />
            <Route path="/products" element={<Products />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/premade" element={<Premade />} />
            <Route path="/delivery-cost" element={<DeliveryCost />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/batches/:id" element={<Batches />} />
            <Route path="/production" element={<Production />} />
            <Route path="/production/:name" element={<Production />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
