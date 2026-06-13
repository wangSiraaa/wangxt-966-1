import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import { LeaseService } from './services/lease.service';
import { ArrearsService } from './services/arrears.service';

import parkingSpaceRoutes from './routes/parkingSpace.routes';
import tenantRoutes from './routes/tenant.routes';
import vehicleRoutes from './routes/vehicle.routes';
import leaseRoutes from './routes/lease.routes';
import arrearsRoutes from './routes/arrears.routes';
import invoiceRoutes from './routes/invoice.routes';
import spaceSwapRoutes from './routes/spaceSwap.routes';
import priceTierRoutes from './routes/priceTier.routes';
import auditLogRoutes from './routes/auditLog.routes';
import fiscalPeriodRoutes from './routes/fiscalPeriod.routes';
import adjustmentOrderRoutes from './routes/adjustmentOrder.routes';
import waitlistRoutes from './routes/waitlist.routes';
import lifecycleRoutes from './routes/lifecycle.routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/parking-spaces', parkingSpaceRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/arrears', arrearsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/space-swaps', spaceSwapRoutes);
app.use('/api/price-tiers', priceTierRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/fiscal-periods', fiscalPeriodRoutes);
app.use('/api/adjustment-orders', adjustmentOrderRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/lifecycle', lifecycleRoutes);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized');

    try {
      LeaseService.processExpiredLeases();
      ArrearsService.updateAgeDays();
    } catch (e) {
      console.error('Initial processing error:', e);
    }

    setInterval(() => {
      try {
        LeaseService.processExpiredLeases();
        ArrearsService.updateAgeDays();
      } catch (e) {
        console.error('Scheduled task error:', e);
      }
    }, 60 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`Parking Lease Server running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

startServer();

export default app;
