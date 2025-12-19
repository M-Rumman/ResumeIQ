#include "OrderItem.h"

// Default constructor
OrderItem::OrderItem()
    : componentId(0), componentName(""), quantity(0), price(0.0) {}

// Parameterized constructor
OrderItem::OrderItem(int id, const string& name, int qty, double price)
    : componentId(id), componentName(name), quantity(qty), price(price) {}

// Getters
int OrderItem::getComponentId() const {
    return componentId;
}

string OrderItem::getComponentName() const {
    return componentName;
}

int OrderItem::getQuantity() const {
    return quantity;
}

double OrderItem::getPrice() const {
    return price;
}

// Setters
void OrderItem::setComponentId(int id) {
    componentId = id;
}

void OrderItem::setComponentName(const string& name) {
    componentName = name;
}

void OrderItem::setQuantity(int qty) {
    quantity = qty;
}

void OrderItem::setPrice(double priceVal) {
    price = priceVal;
}
