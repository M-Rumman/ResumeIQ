#ifndef ORDER_H
#define ORDER_H

#include <string>
#include <vector>
#include <iostream>
#include "OrderItem.h"
using namespace std;

class Order {
private:
    int id;
    int userId;
    vector<OrderItem> items;
    double total;
    string customerWhatsapp;

public:
    // Constructors
    Order();
    Order(int id, int userId, const vector<OrderItem>& items, const string& customerWhatsapp);

    // Calculate total price from items
    double calculateTotal() const;

    // Getters
    int getId() const;
    int getUserId() const;
    vector<OrderItem> getItems() const;
    double getTotal() const;
    string getCustomerWhatsapp() const;
    void recalculateTotal();


    // Setters (if needed later)
    void setId(int id);
    void setUserId(int uid);
    void setCustomerWhatsapp(const string& w);
    void setItems(const vector<OrderItem>& its);

    // Operator overloading
    bool operator<(const Order &other) const {
        return total < other.total;
    }

    friend ostream& operator<<(ostream &out, const Order &o) {
        out << "Order#" << o.id
            << ", User: " << o.userId
            << ", Total: PKR" << o.total;
        return out;
    }
};

#endif

