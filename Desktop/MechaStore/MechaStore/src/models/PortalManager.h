#ifndef PORTALMANAGER_H
#define PORTALMANAGER_H

#include <vector>
#include <string>
#include <algorithm>  // for max
#include "User.h"
#include "Customer.h"
#include "Admin.h"
#include "Component.h"
#include "Order.h"

class PortalManager {
private:
    std::vector<User*> users;
    std::vector<Component> components;
    std::vector<Order> orders;

public:
    Component* findComponentById(int id);
    PortalManager() {
    loadUsers();
    loadComponents();
    loadOrders();
}

    // Users
    void registerUser(User* u);
    User* login(const std::string& username, const std::string& password);
    std::vector<User*>& getUsers() { return users; }

	// Components
    void addComponent(const Component &c) { components.push_back(c); }
    std::vector<Component>& getComponents();

    // Orders
    void addOrder(const Order &o);
	std::vector<Order>& getOrders();

    void processOrder(const std::vector<OrderItem>& items);

    // ID generators
    int generateUserId();
    int generateOrderId();

    // Persistence
    void saveUsers();
    void loadUsers();

    void saveComponents();
    void loadComponents();

    void saveOrders();
    void loadOrders();
};
extern PortalManager store;

#endif

