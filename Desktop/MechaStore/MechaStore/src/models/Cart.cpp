#include "Cart.h"
#include <algorithm>

Cart::Cart() {}

void Cart::addItem(const Component &n, int qty) {
    for (auto &item : items) {
        if (item.getComponent().getId() == n.getId()) {
            item.setQuantity(item.getQuantity() + qty);
            return;
        }
    }
    items.push_back(CartItem(n, qty));
}

double Cart::getCartTotal() const {
    double total = 0;
    for (const auto &item : items) total += item.getComponent().getPrice() * item.getQuantity();
    return total;
}

void Cart::removeItem(int componentId) {
    for (int i = 0; i < (int)items.size(); i++) {
        if (items[i].getComponent().getId() == componentId) {
            items.erase(items.begin() + i);
            return;
        }
    }
}

const vector<CartItem>& Cart::getItems() const {
    return items;
}

void Cart::clear() {
    items.clear();
}

void Cart::sortItemsByPrice() {
    sort(items.begin(), items.end(), [](const CartItem &a, const CartItem &b) {
        return a.getComponent().getPrice() < b.getComponent().getPrice();
    });
}

