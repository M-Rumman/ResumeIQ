#ifndef ADMIN_H
#define ADMIN_H
#include "User.h"
#include <string>
#include <vector>
#include "Component.h"
#include "Order.h"
using namespace std;

class Admin : public User {
public:
    Admin();
    Admin(int id, const string &username, const string &password, const string &whatsapp_no);

    // Admin operations
    void addComponent(vector<Component> &components, const Component &c);
    void updateComponent(Component &c, const string &name, double price, int quantity);
    void deleteComponent(vector<Component> &components, int componentId);
    void viewOrders(const vector<Order> &orders) const;

    // Sorting example
    void sortComponentsByPrice(vector<Component> &components);

    virtual ~Admin() {}  // <--- virtual destructor (good practice)
};

#endif

