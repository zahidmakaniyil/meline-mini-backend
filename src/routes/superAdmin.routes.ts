import { Router } from 'express'
import * as superAdminController from '../controllers/superAdmin.controller'
import * as moduleCatalogController from '../controllers/moduleCatalog.controller'
import * as branchController from '../controllers/branch.controller'
import * as staffTypeController from '../controllers/staffType.controller'
import * as serviceCatalogController from '../controllers/serviceCatalog.controller'
import { requireSuperAdmin, verifyToken } from '../middleware/auth.middleware'

const router = Router()

router.use(verifyToken, requireSuperAdmin)

router.get('/modules', moduleCatalogController.listModules)
router.get('/modules/:id', moduleCatalogController.getModule)
router.post('/modules', moduleCatalogController.createModule)
router.patch('/modules/:id', moduleCatalogController.updateModule)
router.delete('/modules/:id', moduleCatalogController.removeModule)

router.get('/admins', superAdminController.listAdmins)
router.get('/admins/:id', superAdminController.getAdmin)
router.post('/admins', superAdminController.createAdmin)
router.patch('/admins/:id', superAdminController.patchAdmin)
router.post('/admins/:id/reset-password', superAdminController.resetAdminPassword)
router.delete('/admins/:id', superAdminController.removeAdmin)
router.get('/branches/:id/users', superAdminController.listBranchUsers)
router.get('/branches/:id/services', superAdminController.listBranchServices)
router.get('/services/:id/branches', superAdminController.listServiceBranches)

router.post('/branches', branchController.create)
router.get('/branches', branchController.list)
router.get('/branches/:id', branchController.getById)
router.patch('/branches/:id', branchController.update)
router.delete('/branches/:id', branchController.remove)

router.get('/staff-types', staffTypeController.list)
router.post('/staff-types', staffTypeController.create)
router.patch('/staff-types/:id', staffTypeController.update)
router.delete('/staff-types/:id', staffTypeController.remove)

router.get('/service-catalog', serviceCatalogController.list)
router.post('/service-catalog', serviceCatalogController.create)
router.patch('/service-catalog/:id', serviceCatalogController.update)
router.delete('/service-catalog/:id', serviceCatalogController.remove)

export default router
