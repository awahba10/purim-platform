import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import NewOrder from './components/NewOrder';
import AllOrders from './components/AllOrders';
import Materials from './components/Materials';
import Premade from './components/Premade';
import DeliveryCost from './components/DeliveryCost';
import Batches from './components/Batches';
import Products from './components/Products';
import Financials from './components/Financials';

export const NAV = [
  { label: 'New Order', path: '/new-order', icon: '📝' },
  { label: 'All Orders', path: '/orders', icon: '📋' },
  { label: 'Products', path: '/products', icon: '🎁' },
  { label: 'Materials', path: '/materials', icon: '📦' },
  { label: 'Premade Products', path: '/premade', icon: '⭐' },
  { label: 'Delivery Cost', path: '/delivery-cost', icon: '🚚' },
  { label: 'Delivery Batches', path: '/batches', icon: '🗺️' },
  { label: 'Financials', path: '/financials', icon: '💰' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar nav={NAV} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/new-order" replace />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/orders" element={<AllOrders />} />
            <Route path="/orders/:id" element={<AllOrders />} />
            <Route path="/products" element={<Products />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/premade" element={<Premade />} />
            <Route path="/delivery-cost" element={<DeliveryCost />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/batches/:id" element={<Batches />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="*" element={<Navigate to="/new-order" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
