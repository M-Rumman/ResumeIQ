#ifndef CUSTOMER_H
#define CUSTOMER_H
#include "User.h"
#include "Cart.h"
#include <string>
using namespace std;

class Customer : public User {
private:
    Cart cart;

public:
    Customer();
    Customer(int id, const string &username, const string &password, const string &whatsapp_no);

    Cart& getCart();
    void viewCart() const;
    void checkout();  // logic only

    virtual ~Customer() {}  // <--- virtual destructor (good practice)
};

#endif

