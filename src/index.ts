import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes'
import superAdminRoutes from './routes/superAdmin.routes'
import { errorHandler, notFound } from './middleware/error.middleware'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGO_URI

app.use(helmet())
app.use(
  cors({
    origin: [
      process.env.CLIENT_LANDING_URL || 'http://localhost:3000',
      process.env.CLIENT_DASHBOARD_URL || 'http://localhost:5173',
    ],
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Kidsnip API running' })
})

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/super-admin', superAdminRoutes)

app.use(notFound)
app.use(errorHandler)

const start = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('Missing MONGO_URI. Set it in .env (mongodb:// or mongodb+srv://).')
    }
    if (!/^mongodb(\+srv)?:\/\//.test(MONGO_URI)) {
      throw new Error('Invalid MONGO_URI scheme. Must start with mongodb:// or mongodb+srv://')
    }

    await mongoose.connect(MONGO_URI)
    console.log('MongoDB connected')

    const { seedDefaultAppModules } = await import('./services/moduleCatalog.service')
    const { warmModuleKeyCache } = await import('./services/moduleCatalog.cache')
    const { seedDefaultServiceCatalog } = await import('./services/serviceCatalog.service')
    await seedDefaultAppModules()
    await seedDefaultServiceCatalog()
    await warmModuleKeyCache()

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
