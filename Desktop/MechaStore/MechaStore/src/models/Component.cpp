#include "Component.h"

// Default constructor
Component::Component()
    : id(0), name(""), description(""), quantity(0), price(0.0), sellerName(""), sellerWhatsapp("") {}

// Parameterized constructor
Component::Component(int id, const string& name, const string& desc, int qty, double price,
                     const string& sellerName, const string& sellerWhatsapp)
    : id(id), name(name), description(desc), quantity(qty), price(price),
      sellerName(sellerName), sellerWhatsapp(sellerWhatsapp) {}

// Getters
int Component::getId() const {
    return id;
}

string Component::getName() const {
    return name;
}

string Component::getDescription() const {
    return description;
}

int Component::getQuantity() const {
    return quantity;
}

double Component::getPrice() const {
    return price;
}

string Component::getSellerName() const {
    return sellerName;
}

string Component::getSellerWhatsapp() const {
    return sellerWhatsapp;
}

// Setters
void Component::setId(int id) {
    this->id = id;
}

void Component::setName(const string& name) {
    this->name = name;
}

void Component::setDescription(const string& description) {
    this->description = description;
}

void Component::setQuantity(int quantity) {
    this->quantity = quantity;
}

void Component::setPrice(double price) {
    this->price = price;
}

void Component::setSellerName(const string& sellerName) {
    this->sellerName = sellerName;
}

void Component::setSellerWhatsapp(const string& sellerWhatsapp) {
    this->sellerWhatsapp = sellerWhatsapp;
}
