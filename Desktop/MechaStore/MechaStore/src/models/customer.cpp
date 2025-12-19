#include "Customer.h"
#include "Cart.h"
#include <iostream>
using namespace std;


Customer::Customer() : User() {}
Customer::Customer(int id, const string &username, const string &password, const string &whatsapp_no)
: User(id, username, password, whatsapp_no, false) {}


Cart& Customer::getCart() { return cart; }


void Customer::viewCart() const {
cout << "Viewing cart (logic only, no file handling)." << endl;
}


void Customer::checkout() {
cout << "Checkout logic executed (deduct stock, calculate total)." << endl;
}
