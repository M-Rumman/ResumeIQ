#ifndef CARTITEM_H
#define CARTITEM_H

#include "Component.h"
#include <iostream>
using namespace std;

class CartItem {
private:
    Component component;
    int quantity;
public:
    CartItem();
    CartItem(const Component& component, int quantity);

    // getters
    const Component& getComponent() const;
    int getQuantity() const;

    // setters
    void setQuantity(int qty);

    double getTotal() const;

    friend ostream& operator<<(ostream &out, const CartItem &item) {
        out << item.component << " x" << item.quantity << " = PKR" << item.getTotal();
        return out;
    }
};

#endif

