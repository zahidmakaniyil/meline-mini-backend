import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import { verifyToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)
router.get('/me', verifyToken, authController.me)
router.post('/primary-branch', verifyToken, authController.changePrimaryBranch)
router.post('/change-password', verifyToken, authController.changePassword)
router.get('/branches', verifyToken, authController.listMyBranches)

export default router
