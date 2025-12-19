#include "Admin.h"
#include <iostream>
#include <algorithm>
using namespace std;


Admin::Admin() : User() {}
Admin::Admin(int id, const string &username, const string &password, const string &whatsapp_no)
: User(id, username, password, whatsapp_no, true) {}


void Admin::addComponent(vector<Component> &components, const Component &c) {
components.push_back(c);
cout << "Component added (logic only)." << endl;
}


void Admin::updateComponent(Component &c, const string &name, double price, int quantity) {
c.setName(name);
c.setPrice(price);
c.setQuantity(quantity);
cout << "Component updated (logic only)." << endl;
}


void Admin::deleteComponent(vector<Component> &components, int componentId) {
for(auto it = components.begin(); it != components.end(); ++it){
if(it->getId() == componentId){
components.erase(it);
cout << "Component deleted (logic only)." << endl;
return;
}
}
}


void Admin::viewOrders(const vector<Order> &orders) const {
cout << "Viewing orders (logic only)." << endl;
for(const auto &o : orders){
cout << "Order ID: " << o.getId() << ", User ID: " << o.getUserId() << endl;
}
}


void Admin::sortComponentsByPrice(vector<Component> &components){
sort(components.begin(), components.end(), [](const Component &a, const Component &b){
return a.getPrice() < b.getPrice();
});
cout << "Components sorted by price." << endl;
}
