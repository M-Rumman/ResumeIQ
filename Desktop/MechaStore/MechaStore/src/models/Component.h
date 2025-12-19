#ifndef COMPONENTS_H
#define COMPONENTS_H

#include <string>
#include <iostream>
using namespace std;

class Component {
private:
    int id;
    string name;
    string description;
    int quantity;
    double price;

    // Seller Info (already perfect for add-to-cart contact sharing)
    string sellerName;
    string sellerWhatsapp;

public:
    // Constructors
    Component();
    Component(int id, const string& name, const string& desc, int qty, double price,
              const string& sellerName, const string& sellerWhatsapp);

    // Getters
    int getId() const;
    string getName() const;
    string getDescription() const;
    int getQuantity() const;
    double getPrice() const;
    string getSellerName() const;
    string getSellerWhatsapp() const;

    // Setters
    void setId(int id);
    void setName(const string& name);
    void setDescription(const string& description);
    void setQuantity(int quantity);
    void setPrice(double price);
    void setSellerName(const string& sellerName);
    void setSellerWhatsapp(const string& sellerWhatsapp);

    // Operator Overloading
    bool operator==(const Component &other) const { return id == other.id; }
    bool operator<(const Component &other) const { return price < other.price; }

    friend ostream& operator<<(ostream &out, const Component &c) {
        out << c.name << " (PKR" << c.price << ")";
        return out;
    }
};

#endif

