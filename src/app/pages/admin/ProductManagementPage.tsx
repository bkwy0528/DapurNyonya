import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { ArrowLeft, Plus, Edit, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getProducts, saveProduct, deleteProduct } from '../../utils/db';

interface ProductManagementPageProps {
  user: User;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  unit: string;
  prepDays: number;
  available: boolean;
}

export default function ProductManagementPage({ user: _user }: ProductManagementPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    unit: '',
    prepDays: '3',
    available: true,
  });

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({ ...prev, image: base64String }));
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.price || !formData.unit || !formData.prepDays) {
      toast.error('Please fill in all required fields');
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    const prepDays = parseInt(formData.prepDays, 10);
    if (isNaN(prepDays) || prepDays < 1) {
      toast.error('Preparation days must be at least 1');
      return;
    }

    if (editingProduct) {
      const updated: Product = { ...editingProduct, ...formData, price, prepDays };
      await saveProduct(updated);
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
      toast.success('Product updated successfully!');
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        ...formData,
        price,
        prepDays,
      };
      await saveProduct(newProduct);
      setProducts(prev => [...prev, newProduct]);
      toast.success('Product added successfully!');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      image: product.image,
      unit: product.unit,
      prepDays: String(product.prepDays || 3),
      available: product.available,
    });
    setImagePreview(product.image);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Product deleted successfully!');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', image: '', unit: '', prepDays: '3', available: true });
    setImagePreview('');
    setEditingProduct(null);
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner page-hero__inner--wide">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl">Product Management</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="lg" className="success-button">
              <Plus className="w-5 h-5 mr-2" />
              Add New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Traditional Dumplings" className="h-12" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe your product..." className="min-h-24" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (RM) *</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} placeholder="25.00" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Input id="unit" value={formData.unit} onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))} placeholder="e.g., pack (12 pieces)" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prepDays">Preparation Days *</Label>
                  <Input id="prepDays" type="number" min="1" step="1" value={formData.prepDays} onChange={(e) => setFormData(prev => ({ ...prev, prepDays: e.target.value }))} placeholder="3" className="h-12" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product Image *</Label>
                <div className="space-y-3">
                  {imagePreview && (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => { setImagePreview(''); setFormData(prev => ({ ...prev, image: '' })); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <div className="flex items-center justify-center h-12 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                        <Upload className="w-5 h-5 mr-2 text-gray-600" />
                        <span className="text-sm text-gray-600">Upload Image</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </div>
                    </label>
                    <div className="text-sm text-gray-500 flex items-center">or</div>
                    <Input placeholder="Image URL" value={formData.image.startsWith('data:') ? '' : formData.image} onChange={(e) => { setFormData(prev => ({ ...prev, image: e.target.value })); setImagePreview(e.target.value); }} className="flex-1 h-12" />
                  </div>
                  <p className="text-xs text-gray-500">Upload an image (max 5MB) or enter an image URL</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <Label htmlFor="available">Product Available</Label>
                <Switch id="available" checked={formData.available} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available: checked }))} />
              </div>

              <Button onClick={handleSaveProduct} size="lg" className="w-full h-12 brand-button">
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-gray-600 mt-1">{product.description}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${product.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {product.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Price</p>
                        <p className="text-2xl font-bold text-orange-600">RM {product.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Unit</p>
                        <p className="font-semibold text-gray-900">{product.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Preparation</p>
                        <p className="font-semibold text-gray-900">{product.prepDays || 3} day(s)</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button variant="outline" onClick={() => handleEditProduct(product)} className="flex-1 border-2">
                        <Edit className="w-4 h-4 mr-2" />Edit
                      </Button>
                      <Button variant="outline" onClick={() => handleDeleteProduct(product.id)} className="flex-1 border-2 border-red-200 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-2" />Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
