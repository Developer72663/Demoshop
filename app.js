const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'demoshop-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/demoshop';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// ==================== MODELS ====================

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String },
    avatar: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Seller Schema
const sellerSchema = new mongoose.Schema({
    shopName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const Seller = mongoose.model('Seller', sellerSchema);

// Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    image: { type: String },
    category: { type: String },
    stock: { type: Number, default: 0 },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// Cart Schema (for users)
const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1 }
    }]
});
const Cart = mongoose.model('Cart', cartSchema);

// ==================== PASSPORT GOOGLE OAUTH ====================

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/user/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value
            });
            await user.save();
        }
        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ==================== MIDDLEWARE ====================

// Pass user/seller to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.seller = req.session.seller || null;
    next();
});

// Auth middleware
const requireUserAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/signin');
    next();
};

const requireSellerAuth = (req, res, next) => {
    if (!req.session.seller) return res.redirect('/seller/login');
    next();
};

// ==================== GOOGLE AUTH ROUTES ====================

// Google Auth - Initiate
app.get('/user/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google Auth - Callback
app.get('/user/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/signin' }),
    (req, res) => {
        req.session.user = {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            avatar: req.user.avatar
        };
        res.redirect('/');
    }
);

// ==================== HOME ROUTE ====================

app.get('/', async (req, res) => {
    try {
        const products = await Product.find().populate('seller', 'shopName');
        res.render('home', {
            user: req.session.user || null,
            seller: req.session.seller || null,
            products: products || []
        });
    } catch (err) {
        console.error(err);
        res.render('home', { user: null, seller: null, products: [] });
    }
});

// ==================== USER AUTH ROUTES ====================

// Sign Up
app.get('/signup', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('signup', { error: null, user: null, seller: null });
});

app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signup', { error: 'Email already exists', user: null, seller: null });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        req.session.user = { id: user._id, name: user.name, email: user.email };
        res.redirect('/');
    } catch (err) {
        res.render('signup', { error: 'Registration failed', user: null, seller: null });
    }
});

// Sign In
app.get('/signin', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('signin', { error: null, user: null, seller: null });
});

app.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('signin', { error: 'Invalid email or password', user: null, seller: null });
        }
        req.session.user = { id: user._id, name: user.name, email: user.email };
        res.redirect('/');
    } catch (err) {
        res.render('signin', { error: 'Login failed', user: null, seller: null });
    }
});

// User Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// User Account
app.get('/account', requireUserAuth, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    res.render('account', { user: req.session.user, seller: null, accountUser: user });
});

// ==================== SELLER AUTH ROUTES ====================

// Seller Registration
app.get('/seller/register', (req, res) => {
    if (req.session.seller) return res.redirect('/seller/dashboard');
    res.render('sellerRegister', { error: null, user: null, seller: null });
});

app.post('/seller/register', async (req, res) => {
    try {
        const { shopName, email, password, phone, address } = req.body;
        const existingSeller = await Seller.findOne({ email });
        if (existingSeller) {
            return res.render('sellerRegister', { error: 'Email already registered', user: null, seller: null });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const seller = new Seller({ shopName, email, password: hashedPassword, phone, address });
        await seller.save();
        req.session.seller = { id: seller._id, shopName: seller.shopName, email: seller.email };
        res.redirect('/seller/dashboard');
    } catch (err) {
        res.render('sellerRegister', { error: 'Registration failed', user: null, seller: null });
    }
});

// Seller Login
app.get('/seller/login', (req, res) => {
    if (req.session.seller) return res.redirect('/seller/dashboard');
    res.render('sellerLogin', { error: null, user: null, seller: null });
});

app.post('/seller/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const seller = await Seller.findOne({ email });
        if (!seller || !(await bcrypt.compare(password, seller.password))) {
            return res.render('sellerLogin', { error: 'Invalid credentials', user: null, seller: null });
        }
        req.session.seller = { id: seller._id, shopName: seller.shopName, email: seller.email };
        res.redirect('/seller/dashboard');
    } catch (err) {
        res.render('sellerLogin', { error: 'Login failed', user: null, seller: null });
    }
});

// Seller Logout
app.get('/seller/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==================== SELLER DASHBOARD ROUTES ====================

// Seller Dashboard
app.get('/seller/dashboard', requireSellerAuth, async (req, res) => {
    try {
        const products = await Product.find({ seller: req.session.seller.id });
        const sellerData = await Seller.findById(req.session.seller.id);
        const totalIncome = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        res.render('sellerHome', {
            user: null,
            seller: req.session.seller,
            products: products,
            sellerData: sellerData,
            totalIncome: totalIncome
        });
    } catch (err) {
        console.error(err);
        res.render('sellerHome', { user: null, seller: req.session.seller, products: [], sellerData: null, totalIncome: 0 });
    }
});

// Seller Account
app.get('/seller/account', requireSellerAuth, async (req, res) => {
    const sellerData = await Seller.findById(req.session.seller.id);
    res.render('sellerAccount', { user: null, seller: req.session.seller, sellerData: sellerData });
});

app.post('/seller/account', requireSellerAuth, async (req, res) => {
    try {
        const { shopName, phone, address } = req.body;
        await Seller.findByIdAndUpdate(req.session.seller.id, { shopName, phone, address });
        req.session.seller.shopName = shopName;
        res.redirect('/seller/account');
    } catch (err) {
        res.redirect('/seller/account');
    }
});

// ==================== PRODUCT CRUD ROUTES (SELLER) ====================

// Add Product
app.post('/seller/products/add', requireSellerAuth, async (req, res) => {
    try {
        const { name, description, price, category, stock, image } = req.body;
        const product = new Product({
            name,
            description,
            price: parseFloat(price),
            category,
            stock: parseInt(stock),
            image: image || '',
            seller: req.session.seller.id
        });
        await product.save();
        res.redirect('/seller/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/seller/dashboard');
    }
});

// Update Product
app.post('/seller/products/update/:id', requireSellerAuth, async (req, res) => {
    try {
        const { name, description, price, category, stock, image } = req.body;
        await Product.findOneAndUpdate(
            { _id: req.params.id, seller: req.session.seller.id },
            { name, description, price: parseFloat(price), category, stock: parseInt(stock), image: image || '' }
        );
        res.redirect('/seller/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/seller/dashboard');
    }
});

// Delete Product
app.post('/seller/products/delete/:id', requireSellerAuth, async (req, res) => {
    try {
        await Product.findOneAndDelete({ _id: req.params.id, seller: req.session.seller.id });
        res.redirect('/seller/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/seller/dashboard');
    }
});

// ==================== CART ROUTES ====================

app.get('/cart', requireUserAuth, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.session.user.id }).populate('items.product');
        res.render('cart', { user: req.session.user, seller: null, cart: cart || { items: [] } });
    } catch (err) {
        res.render('cart', { user: req.session.user, seller: null, cart: { items: [] } });
    }
});

app.post('/cart/add', requireUserAuth, async (req, res) => {
    try {
        const { productId } = req.body;
        let cart = await Cart.findOne({ user: req.session.user.id });
        if (!cart) {
            cart = new Cart({ user: req.session.user.id, items: [] });
        }
        const existingItem = cart.items.find(item => item.product.toString() === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.items.push({ product: productId, quantity: 1 });
        }
        await cart.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});

// ==================== PRODUCTS BROWSE ====================

app.get('/products', async (req, res) => {
    try {
        const products = await Product.find().populate('seller', 'shopName');
        res.render('products', { user: req.session.user || null, seller: req.session.seller || null, products });
    } catch (err) {
        res.render('products', { user: null, seller: null, products: [] });
    }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
