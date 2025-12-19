#ifndef USER_H
#define USER_H
#include <string>
using namespace std;

class User {
protected:  // change cms_id etc. to protected so derived classes can access if needed
    int cms_id;
    string username;
    string password;
    string whatsapp_no;
    bool isAdmin;

public:
    User();
    User(int id, string username, string password, string whatsapp_no, bool isAdmin);

    virtual ~User() {}  // <--- Added virtual destructor for polymorphism

    const int getId() const;
    string getWhatsapp() const;
    const string getUserName() const;
    const string getPassword() const;
    virtual bool getisAdmin() const;  // make this virtual
    void setWhatsapp(string whatsapp_no);
    bool verifyPassword(string input) const;
};

#endif

