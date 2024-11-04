import { Request, Response } from 'express';
import { pool } from '../db';
import axios from 'axios';
import { redisClient } from '../redisClient';

const SKINPORT_API_URL = 'https://docs.skinport.com/#items';
const APP_ID = 'default';
const CURRENCY = 'default';

// Вспомогательная функция для запроса к API Skinport
const fetchItemsFromSkinport = async () => {
  const response = await axios.get(SKINPORT_API_URL, {
    params: {
      app_id: APP_ID,
      currency: CURRENCY,
    },
  });
  return response.data;
};

// Вспомогательная функция для обработки предметов
const processItems = (items: any[]) => {
  // Массив для хранения предметов с минимальными ценами
  const processedItems = items.map((item) => {
    // Находим минимальные цены tradable и non-tradable
    const tradablePrices = item.prices.filter((price: any) => price.tradable);
    const nonTradablePrices = item.prices.filter((price: any) => !price.tradable);

    const minTradablePrice = Math.min(...tradablePrices.map((price: any) => price.amount));
    const minNonTradablePrice = Math.min(...nonTradablePrices.map((price: any) => price.amount));

    return {
      id: item.id,
      name: item.name,
      minTradablePrice,
      minNonTradablePrice,
    };
  });

  return processedItems;
};

// Контроллер для получения предметов с кешированием
export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    // Проверяем, есть ли предметы в кеше
    const cachedItems = await redisClient.get('items');
    
    if (cachedItems) {
      // Если данные есть в кеше, отправляем их
      res.json(JSON.parse(cachedItems));
      return;
    }

    // Если данных нет в кеше, запрашиваем их из API
    const items = await fetchItemsFromSkinport();

    // Обрабатываем предметы
    const processedItems = processItems(items);

    // Кешируем данные в Redis на 1 час (3600 секунд)
    await redisClient.set('items', JSON.stringify(processedItems), {
      EX: 3600,
    });

    // Отправляем ответ с обработанными предметами
    res.json(processedItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


export const buyItem = async (req: Request, res: Response): Promise<void> => {
    const { userId, itemId, price } = req.body;

    const client = await pool.connect(); // Получаем клиент для транзакции

    try {
        // Начинаем транзакцию
        await client.query('BEGIN');

        // Проверка баланса пользователя
        const userResult = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK'); // Откатываем транзакцию в случае ошибки
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const balance = userResult.rows[0].balance;

        if (balance < price) {
            await client.query('ROLLBACK'); // Откатываем транзакцию в случае недостаточного баланса
            res.status(400).json({ message: 'Insufficient balance' });
            return;
        }

        // Обновление баланса
        const newBalance = balance - price;
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);

        // Добавление записи о покупке
        await client.query(
            'INSERT INTO purchases (user_id, item_id, price) VALUES ($1, $2, $3)',
            [userId, itemId, price]
        );

        // Подтверждаем транзакцию
        await client.query('COMMIT');

        res.json({ message: 'Purchase successful', newBalance });
    } catch (err) {
        // Откат транзакции в случае ошибки
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        // Освобождаем клиента
        client.release();
    }
};


