#include "PortalManager.h"
#include <fstream>
#include <sstream>
#include <algorithm>  // for std::max_element

// ------------------------------
// USER MANAGEMENT
// ------------------------------

PortalManager store;

void PortalManager::registerUser(User* u) {
	users.push_back(u);
	saveUsers();
}

User* PortalManager::login(const std::string& username, const std::string& password) {
	for (auto u : users) {
        if (u->getUserName() == username && u->verifyPassword(password)) {
            return u;
        }
    }
    return nullptr;
}

// ------------------------------
// COMPONENT MANAGEMENT
// ------------------------------
std::vector<Component>& PortalManager::getComponents() {
	return components;
}

// ------------------------------
// ORDER MANAGEMENT
// ------------------------------
void PortalManager::addOrder(const Order &o) {
    orders.push_back(o);
}

std::vector<Order>& PortalManager::getOrders() {
    return orders;
}

// ------------------------------
// ID GENERATION (C++17 style)
// ------------------------------
int PortalManager::generateUserId() {
    if (users.empty()) return 1;
    auto it = std::max_element(users.begin(), users.end(),
                               [](User* a, User* b){ return a->getId() < b->getId(); });
    return (*it)->getId() + 1;
}

int PortalManager::generateOrderId() {
    if (orders.empty()) return 1;
    auto it = std::max_element(orders.begin(), orders.end(),
                               [](const Order &a, const Order &b){ return a.getId() < b.getId(); });
    return it->getId() + 1;
}

// ------------------------------
// FILE PERSISTENCE
// ------------------------------

// USERS
void PortalManager::saveUsers() {
    std::ofstream out("users.txt");
    if (!out) return;
    for (auto *u : users) {
        out << u->getId() << "|" << u->getUserName() << "|" << u->getPassword()
            << "|" << u->getWhatsapp() << "|" << u->getisAdmin() << "\n";
    }
}

void PortalManager::loadUsers() {
    std::ifstream in("users.txt");

    if (!in || in.peek() == std::ifstream::traits_type::eof()) {
        // Create default admin ONCE
        Admin* admin = new Admin(1, "admin", "admin123", "03000000000");
        users.push_back(admin);
        saveUsers();
        return;
    }

    users.clear();
    std::string line;
    while (getline(in, line)) {
        std::stringstream ss(line);
        std::string id, username, password, whatsapp, isAdmin;
        getline(ss, id, '|');
        getline(ss, username, '|');
        getline(ss, password, '|');
        getline(ss, whatsapp, '|');
        getline(ss, isAdmin, '|');

        if (isAdmin == "1")
            users.push_back(new Admin(stoi(id), username, password, whatsapp));
        else
            users.push_back(new Customer(stoi(id), username, password, whatsapp));
    }
}

// COMPONENTS
void PortalManager::saveComponents() {
    std::ofstream out("components.txt");
    if (!out) return;
    for (auto &c : components) {
        out << c.getId() << "|" << c.getName() << "|" << c.getDescription() << "|"
            << c.getQuantity() << "|" << c.getPrice() << "|" << c.getSellerName()
            << "|" << c.getSellerWhatsapp() << "\n";
    }
}

void PortalManager::loadComponents() {
    std::ifstream in("components.txt");
    if (!in) return;
    components.clear();
    std::string line;
    while (getline(in, line)) {
        std::stringstream ss(line);
        std::string id, name, desc, qty, price, seller, phone;
        getline(ss, id, '|'); getline(ss, name, '|'); getline(ss, desc, '|');
        getline(ss, qty, '|'); getline(ss, price, '|'); getline(ss, seller, '|'); getline(ss, phone, '|');
        components.push_back(Component(std::stoi(id), name, desc, std::stoi(qty), std::stod(price), seller, phone));
    }
}

// ORDERS
void PortalManager::saveOrders() {
    std::ofstream out("orders.txt");
    if (!out) return;
    for (auto &o : orders) {
        out << o.getId() << "|" << o.getUserId() << "|" << o.getCustomerWhatsapp() << "|" << o.getTotal() << "\n";
        for (auto &item : o.getItems()) {
            out << item.getComponentId() << "," << item.getComponentName() << ","
                << item.getQuantity() << "," << item.getPrice() << ";\n";
        }
        out << "#\n";
    }
}

void PortalManager::loadOrders() {
    std::ifstream in("orders.txt");
    if (!in) return;
    orders.clear();
    std::string line;
    Order current;
    std::vector<OrderItem> tempItems;
    while (getline(in, line)) {
        if (line == "#") {
            current.setItems(tempItems);
            current.recalculateTotal();
            orders.push_back(current);
            tempItems.clear();
            continue;
        }
        if (line.find('|') != std::string::npos) {
            std::stringstream ss(line);
            std::string id, userId, phone, total;
            getline(ss, id, '|'); getline(ss, userId, '|'); getline(ss, phone, '|'); getline(ss, total, '|');
            current = Order();
            current.setId(std::stoi(id));
            current.setUserId(std::stoi(userId));
            current.setCustomerWhatsapp(phone);
            continue;
        }
        std::stringstream ss(line);
        std::string id, name, qty, price;
        getline(ss, id, ','); getline(ss, name, ','); getline(ss, qty, ','); getline(ss, price, ';');
        tempItems.push_back(OrderItem(std::stoi(id), name, std::stoi(qty), std::stod(price)));
    }

    // Add last order if file didn't end with #
    if (!tempItems.empty()) {
        current.setItems(tempItems);
        current.recalculateTotal();
        orders.push_back(current);
    }
}

void PortalManager::processOrder(const std::vector<OrderItem>& items)
{
    for (const auto &item : items)
    {
        for (auto it = components.begin(); it != components.end(); )
        {
            if (it->getId() == item.getComponentId())
            {
                int newQty = it->getQuantity() - item.getQuantity();
                it->setQuantity(newQty);

                if (it->getQuantity() <= 0)
                    it = components.erase(it);
                else
                    ++it;
            }
            else
                ++it;
        }
    }

    saveComponents();
}

Component* PortalManager::findComponentById(int id)
{
    for (auto &c : components)
        if (c.getId() == id)
            return &c;
    return nullptr;
}


