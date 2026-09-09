import { useState } from 'react';
import Sidebar from './components/Sidebar';
import NewOrder from './components/NewOrder';
import AllOrders from './components/AllOrders';
import Materials from './components/Materials';
import Premade from './components/Premade';
import DeliveryCost from './components/DeliveryCost';
import Batches from './components/Batches';
import Products from './components/Products';
import Financials from './components/Financials';

const TABS = [
  'New Order',
  'All Orders',
  'Products',
  'Materials',
  'Premade Products',
  'Delivery Cost',
  'Delivery Batches',
  'Financials',
];

export default function App() {
  const [tab, setTab] = useState('New Order');

  return (
    <div className="layout">
      <Sidebar tabs={TABS} active={tab} onSelect={setTab} />
      <main className="content">
        {tab === 'New Order' && (
          <NewOrder onCreated={() => setTab('All Orders')} />
        )}
        {tab === 'All Orders' && <AllOrders />}
        {tab === 'Materials' && <Materials />}
        {tab === 'Premade Products' && <Premade />}
        {tab === 'Delivery Cost' && <DeliveryCost />}
        {tab === 'Delivery Batches' && <Batches />}
        {tab === 'Products' && <Products />}
        {tab === 'Financials' && <Financials />}
      </main>
    </div>
  );
}
