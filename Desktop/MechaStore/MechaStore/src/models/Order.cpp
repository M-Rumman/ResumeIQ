#include "Order.h"

// Default constructor
Order::Order()
    : id(0), userId(0), total(0.0), customerWhatsapp("") {}

Order::Order(int id_, int userId_, const vector<OrderItem>& items_, const string& customerWhatsapp_)
    : id(id_), userId(userId_), items(items_), customerWhatsapp(customerWhatsapp_) {
    total = calculateTotal();
}

// Calculate total price by summing price * quantity of all items
double Order::calculateTotal() const {
    double sum = 0.0;
    for (const auto& item : items) {
        sum += item.getPrice() * item.getQuantity();
    }
    return sum;
}

// Getters
int Order::getId() const {
    return id;
}

int Order::getUserId() const {
    return userId;
}

vector<OrderItem> Order::getItems() const {
    return items;
}

double Order::getTotal() const {
    return total;
}

string Order::getCustomerWhatsapp() const {
    return customerWhatsapp;
}

// Setters
void Order::setId(int id_) { id = id_; }
void Order::setUserId(int uid) { userId = uid; }
void Order::setItems(const vector<OrderItem>& its) { items = its; total = calculateTotal(); }
void Order::setCustomerWhatsapp(const string& w) { customerWhatsapp = w; }
void Order::recalculateTotal() {
    total = 0;
    for (const auto &item : items) {
        total += item.getPrice() * item.getQuantity();
    }
}


