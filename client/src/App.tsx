import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  CarOutlined,
  UserOutlined,
  FileTextOutlined,
  WarningOutlined,
  SwapOutlined,
  FileDoneOutlined,
  BgColorsOutlined,
  HistoryOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  TagsOutlined,
  CalculatorOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ParkingSpacePool from './pages/ParkingSpacePool';
import ExpiringQueue from './pages/ExpiringQueue';
import LeaseManagement from './pages/LeaseManagement';
import LeaseDetail from './pages/LeaseDetail';
import ArrearsManagement from './pages/ArrearsManagement';
import TenantManagement from './pages/TenantManagement';
import VehicleManagement from './pages/VehicleManagement';
import SpaceSwapApproval from './pages/SpaceSwapApproval';
import InvoiceManagement from './pages/InvoiceManagement';
import PriceTierManagement from './pages/PriceTierManagement';
import AuditLogs from './pages/AuditLogs';
import RenewalTrial from './pages/RenewalTrial';
import RefundTrial from './pages/RefundTrial';
import BatchRenewal from './pages/BatchRenewal';

const { Header, Sider, Content } = Layout;

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/expiring', icon: <ClockCircleOutlined />, label: '到期队列' },
    { key: '/parking-pool', icon: <BgColorsOutlined />, label: '车位池' },
    { key: '/leases', icon: <FileTextOutlined />, label: '租约管理' },
    { key: '/arrears', icon: <WarningOutlined />, label: '欠费管理' },
    { key: '/tenants', icon: <UserOutlined />, label: '租户管理' },
    { key: '/vehicles', icon: <CarOutlined />, label: '车辆管理' },
    { key: '/space-swaps', icon: <SwapOutlined />, label: '调换审批' },
    { key: '/renewal-trial', icon: <CalculatorOutlined />, label: '续费试算' },
    { key: '/refund-trial', icon: <DollarOutlined />, label: '退款试算' },
    { key: '/batch-renewal', icon: <ThunderboltOutlined />, label: '批量处理' },
    { key: '/invoices', icon: <FileDoneOutlined />, label: '发票管理' },
    { key: '/price-tiers', icon: <TagsOutlined />, label: '阶梯价管理' },
    { key: '/audit-logs', icon: <HistoryOutlined />, label: '审计日志' },
  ];

  return (
    <Layout className="layout-full">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo">{collapsed ? '车位' : '车位管理系统'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key as string)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer }}>
          <h2 style={{ margin: 0 }}>车位月租续费管理系统</h2>
        </Header>
        <Content className="content-wrapper">
          <div
            style={{
              padding: 24,
              minHeight: '100%',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expiring" element={<ExpiringQueue />} />
              <Route path="/parking-pool" element={<ParkingSpacePool />} />
              <Route path="/leases" element={<LeaseManagement />} />
              <Route path="/leases/:id" element={<LeaseDetail />} />
              <Route path="/arrears" element={<ArrearsManagement />} />
              <Route path="/tenants" element={<TenantManagement />} />
              <Route path="/vehicles" element={<VehicleManagement />} />
              <Route path="/space-swaps" element={<SpaceSwapApproval />} />
              <Route path="/renewal-trial" element={<RenewalTrial />} />
              <Route path="/refund-trial" element={<RefundTrial />} />
              <Route path="/batch-renewal" element={<BatchRenewal />} />
              <Route path="/invoices" element={<InvoiceManagement />} />
              <Route path="/price-tiers" element={<PriceTierManagement />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
