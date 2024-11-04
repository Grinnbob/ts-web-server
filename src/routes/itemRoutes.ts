import { Router } from 'express';
import { getMinPrices, buyItem } from '../controllers/itemController';

const router = Router();

router.get('/items/min-prices', getMinPrices);
router.post('/items/buy', buyItem);

export default router;
