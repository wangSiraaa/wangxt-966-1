import React from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  CarOutlined,
  TeamOutlined,
  FileTextOutlined,
  SyncOutlined,
  WarningOutlined,
  PayCircleOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/Dashboard.jsx';
import SpacesPage from './pages/Spaces.jsx';
import TenantsPage from './pages/Tenants.jsx';
import LeasesPage from './pages/Leases.jsx';
import RenewalsPage from './pages/Renewals.jsx';
import ArrearsPage from './pages/Arrears.jsx';
import PaymentsPage from './pages/Payments.jsx';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '物业前台工作台' },
  { key: '/spaces', icon: <CarOutlined />, label: '车位管理' },
  { key: '/tenants', icon: <TeamOutlined />, label: '租户管理' },
  { key: '/leases', icon: <FileTextOutlined />, label: '租约管理' },
  { key: '/renewals', icon: <SyncOutlined />, label: '续费管理' },
  { key: '/arrears', icon: <WarningOutlined />, label: '欠费管理' },
  { key: '/payments', icon: <PayCircleOutlined />, label: '收款记录' }
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  return (
    <Layout className="app-layout">
      <Sider theme="dark" width={220} breakpoint="lg" collapsedWidth="0">
        <div className="sider-logo">
          <CarOutlined style={{ marginRight: 8 }} />
          车位续费系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>
            {menuItems.find((m) => m.key === location.pathname)?.label || '车位月租续费管理系统'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
            今日: {new Date().toLocaleDateString('zh-CN')} &nbsp;|&nbsp; 物业前台操作员
          </div>
        </Header>
        <Content style={{ margin: 16 }}>
          <div
            style={{
              padding: 24,
              minHeight: 'calc(100vh - 128px)',
              background: colorBgContainer,
              borderRadius: borderRadiusLG
            }}
          >
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/spaces" element={<SpacesPage />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="/leases" element={<LeasesPage />} />
              <Route path="/renewals" element={<RenewalsPage />} />
              <Route path="/arrears" element={<ArrearsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
