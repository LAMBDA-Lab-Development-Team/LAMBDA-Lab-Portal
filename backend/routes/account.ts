import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { AccountModel } from '../models/account';

const router = express.Router();

router.use(authenticateToken);

router.get('/:type', async (req: Request, res: Response) => {

    const { type } = req.params

    if (!type) {
        res.status(400).send("Mention the account type")
        return
    }

    try {
        const account = await AccountModel.find({ type });
        res.status(200).json(account);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching account: ' + (error as Error).message });
    }
});

router.post('/entry', async (req: Request, res: Response) => {
    try {
        const { type, amount, credited, remarks } = req.body

        const entry = new AccountModel({
            type,
            amount,
            credited,
            remarks
        })

        const newEntry = await entry.save()
        res.status(200).json(newEntry);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching account: ' + (error as Error).message });
    }
});

export default router;
