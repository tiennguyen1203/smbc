import { Router } from 'express';
import { productController } from '../controllers/productController';

const router = Router();

router.get('/', productController.getAllProducts);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export const productRoutes = router;
