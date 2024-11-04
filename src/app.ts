import express from 'express';
import authRoutes from './routes/authRoutes';
import itemRoutes from './routes/itemRoutes';

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/items', itemRoutes);

export default app;
