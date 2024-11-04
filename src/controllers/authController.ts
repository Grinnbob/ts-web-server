import { Request, Response } from 'express';
import { pool } from '../db';
import bcrypt from 'bcrypt';

// Логин пользователя
export const login = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    try {
        // Получаем пользователя по имени пользователя
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        // Если пользователь не найден
        if (userResult.rows.length === 0) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        const user = userResult.rows[0];

        // Сравниваем пароль с хешем, хранимым в базе
        const passwordMatch = await bcrypt.compare(password, user.password);

        // Если пароль не совпадает
        if (!passwordMatch) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        res.json({ message: 'Login successful', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Смена пароля пользователем
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    const { userId, oldPassword, newPassword } = req.body;

    try {
        // Получаем пользователя с его текущим паролем
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

        // Если пользователь не найден
        if (userResult.rows.length === 0) {
            res.status(401).json({ message: 'Invalid user' });
            return;
        }

        const user = userResult.rows[0];

        // Проверяем старый пароль
        const oldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!oldPasswordMatch) {
            res.status(401).json({ message: 'Invalid old password' });
            return;
        }

        // Хешируем новый пароль
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Обновляем пароль в базе данных
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

