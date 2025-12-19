Core Features

User registration & login (username/password)

Browse components list (name, description, price, stock)

Component details view

Add to cart / remove from cart

Checkout (create an order, provide WhatsApp number)

Persist users, components, and orders locally

Admin sees all orders and customer WhatsApp info

Admin Features

Admin login (role-based)

Add new components

Update component details (price, stock)

Delete components

View all orders (customer WhatsApp + ordered items + seller info)

Connect customers with sellers manually

Optional / Stretch Features

Search and filter components

Product images (paths to files)

User order history

Authentication with password hashing

Small GUI (simple windows/forms) instead of console

Use SQLite with migrations instead of flat files

Unit tests for core modules

Data Storage Choices

Start simple with flat JSON files:

Suggested initial files (in /data):

users.json — list of user objects: {id, username, password_hash, role, whatsapp?}

components.json — list of components: {id, name, desc, price, stock, seller: {name, whatsapp}}

orders.json — list of orders: {id, userId, customerWhatsapp, items[], total, createdAt}

Later, migrate to SQLite for stronger querying and transactions:

Tables: users, components, orders, order_items

User Flows (Customer)

Register / Login

Input username + password

Validate and create user entry

Browse Components

List components (all or paginated)

View details of individual components

Add to Cart

Select quantity (≤ stock)

Add to cart session

Checkout

Review cart → confirm → enter WhatsApp number

Create order object

Deduct stock quantities

Save order in orders.json

Admin Flows

Login as Admin

Role check (role == admin)

Manage Components

Add component: enter name, description, price, stock, seller info

Update component: modify fields

Delete component: soft-delete or hard-delete

View Orders

See recent orders and details

View customer WhatsApp number + items + seller info

Connect customer with seller manually

System Requirements / Tech Decisions

Language: C++ (console or GUI) or any OOP language

Build: simple project file or makefile

Data: start with JSON files in /data, move to SQLite later

Tests: optional unit tests for model classes

Minimal Deliverable (MVP) vs Stretch

MVP:

User registration & login (console)

Browse components list (console)

Add to cart & checkout (store WhatsApp)

Admin: add / update / delete components

Admin: view orders (customer + seller info)

JSON persistence

docs/spec.md + README.md