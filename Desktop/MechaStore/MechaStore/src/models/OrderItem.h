#ifndef ORDERITEM_H
#define ORDERITEM_H

#include <string>
#include <iostream>
using namespace std;

class OrderItem {
private:
    int componentId;
    string componentName;
    int quantity;
    double price;

public:
    // Constructors
    OrderItem();
    OrderItem(int id, const string& name, int qty, double price);

    // Getters
    int getComponentId() const;
    string getComponentName() const;
    int getQuantity() const;
    double getPrice() const;

    // Setters
    void setComponentId(int id);
    void setComponentName(const string& name);
    void setQuantity(int qty);
    void setPrice(double price);

    // Additional functionality from your version
    double getTotal() const { return quantity * price; }

    bool operator<(const OrderItem &other) const {
        return price < other.price;
    }

    friend ostream& operator<<(ostream &out, const OrderItem &item) {
        out << item.componentName << " x" << item.quantity
            << " = $" << item.getTotal();
        return out;
    }
};

#endif

