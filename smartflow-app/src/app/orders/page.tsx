'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileNav } from '@/components/layout/AppNav';
import { PageHeader } from '@/components/layout/PageHeader';
import { getMyOrders, getFoodItems, createOrder } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Order, FoodItem } from '@/types';
import { Clock, MapPin, ChevronRight, ShoppingCart, Store, ArrowLeft } from 'lucide-react';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  preparing: { bg: 'rgba(245,158,11,0.1)', text: 'var(--warning)', label: 'Preparing' },
  ready: { bg: 'rgba(16,185,129,0.1)', text: 'var(--success)', label: 'Ready' },
  collected: { bg: 'var(--surface-2)', text: 'var(--text-muted)', label: 'Collected' },
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<'my_orders' | 'explore'>('my_orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isOrdering, setIsOrdering] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function loadData() {
      try {
        const uid = user?.uid || 'u1';
        const [myOrders, items] = await Promise.all([
          getMyOrders(uid),
          getFoodItems()
        ]);
        setOrders(myOrders as Order[]);
        setFoodItems(items as FoodItem[]);
      } catch (error) {
        console.error('Failed to load orders or food items:', error);
      }
    }
    loadData();
  }, [user, authLoading, activeTab]);

  const active = orders.filter(o => o.status !== 'collected');
  const history = orders.filter(o => o.status === 'collected');

  const shops = useMemo(() => {
    return Array.from(new Set(foodItems.map(item => item.vendor)));
  }, [foodItems]);

  const handleOrder = async (item: FoodItem) => {
    if (!user) return;
    setIsOrdering(item.id);
    try {
      await createOrder(user.uid, {
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
        status: 'preparing',
        eta: '10 mins',
        counter: item.vendor,
      });
      // Switch back to my orders and reset
      setActiveTab('my_orders');
      setSelectedShop(null);
    } catch (err) {
      console.error('Failed to order:', err);
      alert('Failed to place order');
    } finally {
      setIsOrdering(null);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader title="Orders & Concessions">
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setActiveTab('my_orders'); setSelectedShop(null); }}
              className={`btn ${activeTab === 'my_orders' ? 'btn-primary' : 'btn-outline'}`}
              style={{ borderRadius: 20 }}
            >
              My Orders
            </button>
            <button
              onClick={() => setActiveTab('explore')}
              className={`btn ${activeTab === 'explore' ? 'btn-primary' : 'btn-outline'}`}
              style={{ borderRadius: 20 }}
            >
              Explore Dishes
            </button>
          </div>
        </PageHeader>

        <div className="page-body">
          {activeTab === 'my_orders' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28, maxWidth: 800, margin: '0 auto' }}>
              {/* Active Orders */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🕐 Active Orders
                  </h2>
                  <span style={{ fontSize: 13, color: 'var(--cyan-dark)', fontWeight: 600 }}>Live Tracking</span>
                </div>
                {active.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>No active orders</div>
                ) : active.map(order => {
                  const s = statusColors[order.status] || statusColors.preparing;
                  return (
                    <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <img src={order.imageUrl} alt={order.name} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{order.name}</div>
                          <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${s.text}30` }}>
                            {s.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {order.eta}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {order.counter}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan-dark)' }}>₹{order.price.toFixed(2)}</div>
                          <button style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                            View Receipt <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent History */}
              {history.length > 0 && (
                <div className="card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📦 Recent History
                  </h2>
                  {history.map(order => {
                    const s = statusColors[order.status] || statusColors.collected;
                    return (
                      <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                        <img src={order.imageUrl} alt={order.name} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{order.name}</div>
                            <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
                              {s.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {order.eta}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {order.counter}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan-dark)' }}>₹{order.price.toFixed(2)}</div>
                            <button style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                              View Receipt <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'explore' && (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              {!selectedShop ? (
                <>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Store size={24} color="var(--cyan-dark)" /> Select a Shop
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {shops.map(shop => {
                      const shopItems = foodItems.filter(i => i.vendor === shop);
                      const displayImage = shopItems.length > 0 ? shopItems[0].imageUrl : '';
                      return (
                        <div 
                          key={shop} 
                          onClick={() => setSelectedShop(shop)}
                          className="card" 
                          style={{ cursor: 'pointer', overflow: 'hidden', padding: 0, transition: 'transform 0.2s', border: '1px solid var(--border)' }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          <img src={displayImage} alt={shop} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                          <div style={{ padding: 20 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{shop}</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{shopItems.length} items available</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setSelectedShop(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20, fontSize: 15, fontWeight: 600, padding: 0 }}
                  >
                    <ArrowLeft size={18} /> Back to Shops
                  </button>
                  <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>{selectedShop} Menu</h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {foodItems.filter(i => i.vendor === selectedShop).map(item => (
                      <div key={item.id} className="card" style={{ padding: 16, display: 'flex', gap: 16 }}>
                        <img src={item.imageUrl} alt={item.name} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.name}</div>
                            <div style={{ fontSize: 14, color: 'var(--cyan-dark)', fontWeight: 700 }}>₹{item.price.toFixed(2)}</div>
                          </div>
                          <button 
                            onClick={() => handleOrder(item)}
                            disabled={isOrdering === item.id}
                            className="btn btn-sm" 
                            style={{ background: 'var(--cyan)', color: 'var(--dark)', fontWeight: 700, alignSelf: 'flex-start', marginTop: 10, opacity: isOrdering === item.id ? 0.7 : 1, border: 'none', cursor: 'pointer' }}
                          >
                            <ShoppingCart size={14} style={{ marginRight: 6 }} />
                            {isOrdering === item.id ? 'Ordering...' : 'Order'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
