#include "CartItem.h"

CartItem::CartItem()
    : component(), quantity(0) {}

CartItem::CartItem(const Component& component_, int quantity_)
    : component(component_), quantity(quantity_) {}

const Component& CartItem::getComponent() const {
    return component;
}

int CartItem::getQuantity() const {
    return quantity;
}

void CartItem::setQuantity(int qty) {
    quantity = qty;
}

double CartItem::getTotal() const {
    return component.getPrice() * quantity;
}

