#ifndef CART_H
#define CART_H
#include "Component.h"
#include "CartItem.h"
#include <vector>
using namespace std;

class Cart{
    vector<CartItem> items;
public:
    Cart();
    void addItem(const Component &n, int qty);
    void removeItem(int componentId);
    double getCartTotal() const;

    // expose items for checkout
    const vector<CartItem>& getItems() const;
    void clear();

    // Sorting example
    void sortItemsByPrice();
};
#endif

